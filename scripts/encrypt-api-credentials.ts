/**
 * One-off: encrypts CLOB API credentials that were stored as plaintext JSON, in the Users table and
 * in the limit order watchers persisted to redis. Run it with the production env after deploying.
 * Safe to re-run; anything already encrypted is skipped.
 */

import { db } from "../src/lib/supabase";
import { redisClient } from "../src/lib/redis";
import { encryptApiCredentials, isPlaintextApiCredentials } from "../src/utils/crypto";

const PAGE_SIZE = 500;
const TRADE_WATCHER_KEY_PREFIX = "user:trade_watchers:";

async function encryptUsersTable() {
    let encrypted = 0;

    for (let from = 0; ; from += PAGE_SIZE) {
        const { data: users, error } = await db("Users")
            .select("id, api_credentials")
            .order("id")
            .range(from, from + PAGE_SIZE - 1);

        if (error) {
            throw new Error(`Failed to fetch users: ${error.message}`);
        }

        for (const user of users) {
            if (!isPlaintextApiCredentials(user.api_credentials)) continue;

            // Matching on the old value skips a row the bot rewrote since it was read
            const { error: updateError } = await db("Users")
                .update({
                    api_credentials: encryptApiCredentials(JSON.parse(user.api_credentials)),
                })
                .eq("id", user.id)
                .eq("api_credentials", user.api_credentials);

            if (updateError) {
                console.error(`Failed to encrypt credentials for user ${user.id}:`, updateError);
                continue;
            }

            encrypted++;
        }

        if (users.length < PAGE_SIZE) break;
    }

    return encrypted;
}

async function encryptTradeWatchers() {
    let encrypted = 0;

    const keys = await redisClient.keys(`${TRADE_WATCHER_KEY_PREFIX}*`);
    for (const key of keys) {
        const entries = await redisClient.hGetAll(key);

        for (const [marketId, value] of Object.entries(entries)) {
            const config = JSON.parse(value);
            if (typeof config.auth === "string") continue;

            await redisClient.hSet(
                key,
                marketId,
                JSON.stringify({ ...config, auth: encryptApiCredentials(config.auth) })
            );
            encrypted++;
        }
    }

    return encrypted;
}

async function main() {
    const users = await encryptUsersTable();
    console.log(`✅ Encrypted API credentials for ${users} users`);

    const watchers = await encryptTradeWatchers();
    console.log(`✅ Encrypted API credentials in ${watchers} limit order watchers`);

    await redisClient.quit();
}

main().catch((error) => {
    console.error("❌ Failed to encrypt API credentials:", error);
    process.exit(1);
});

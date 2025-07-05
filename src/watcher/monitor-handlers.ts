import { redisClient } from "@/lib/redis";
import type { TableRow } from "@/shared/types/supabase";
import { pollForNewTrades } from "@/watcher/helpers";

const activeWalletIntervals = new Map<string, NodeJS.Timeout>();

export const addWalletMonitor = async (data: TableRow<"Copy_Wallets">) => {
    const { is_enabled, user_id, wallet_address } = data;

    const walletKey = wallet_address.toString();
    const redisSetKey = `wallet:MONITOR:${walletKey}`;
    const intervalKey = `wallet:INTERVAL_ACTIVE:${walletKey}`;
    const userEntry = `${user_id.toString()}:${String(is_enabled)}`;

    await redisClient.sAdd(redisSetKey, userEntry);

    if (activeWalletIntervals.has(walletKey)) return;

    const interval = setInterval(() => {
        pollForNewTrades(wallet_address);
    }, 5000);

    activeWalletIntervals.set(wallet_address, interval);
    await redisClient.set(intervalKey, "1");

    console.log(`🟢 Started monitoring ${wallet_address}`);
};

export const updateWalletMonitor = async (data: TableRow<"Copy_Wallets">) => {
    const { is_enabled, user_id, wallet_address } = data;

    const walletKey = wallet_address.toString();
    const redisSetKey = `wallet:MONITOR:${walletKey}`;
    const intervalKey = `wallet:INTERVAL_ACTIVE:${walletKey}`;
    const userPrefix = `${user_id.toString()}:`;
    const updatedEntry = `${user_id.toString()}:${String(is_enabled)}`;

    // Remove old entry for this user (true or false)
    const currentUsers = (await redisClient.sMembers(redisSetKey)) as string[];
    for (const entry of currentUsers) {
        if (entry.startsWith(userPrefix)) {
            await redisClient.sRem(redisSetKey, entry);
        }
    }

    // Add updated entry
    await redisClient.sAdd(redisSetKey, updatedEntry);

    // Check current enabled users
    const allEntries = (await redisClient.sMembers(redisSetKey)) as string[];
    const hasEnabledUser = allEntries.some((entry) => entry.endsWith(":true"));

    const isCurrentlyMonitoring = activeWalletIntervals.has(walletKey);

    if (hasEnabledUser && !isCurrentlyMonitoring) {
        const interval = setInterval(() => {
            pollForNewTrades(wallet_address);
        }, 5000);

        activeWalletIntervals.set(walletKey, interval);
        await redisClient.set(intervalKey, "1");
        console.log(`🟢 (UPDATE) Started monitoring ${wallet_address}`);
    } else if (!hasEnabledUser && isCurrentlyMonitoring) {
        const interval = activeWalletIntervals.get(walletKey);
        if (interval) {
            clearInterval(interval);
            activeWalletIntervals.delete(walletKey);
            await redisClient.del(intervalKey);
            console.log(`🔴 (UPDATE) Stopped monitoring ${wallet_address}`);
        }
    } else {
        console.log(`↔️ (UPDATE) No interval change for ${wallet_address}`);
    }

    console.log(`🔄 Updated monitor for user ${user_id} on wallet ${wallet_address}`);
};

export const deleteWalletMonitor = async (data: TableRow<"Copy_Wallets">) => {
    const { user_id, wallet_address } = data;

    const walletKey = wallet_address.toString();
    const redisSetKey = `wallet:MONITOR:${walletKey}`;
    const intervalKey = `wallet:INTERVAL_ACTIVE:${walletKey}`;
    const userPrefix = `${user_id.toString()}:`;

    const currentUsers = (await redisClient.sMembers(redisSetKey)) as string[];
    for (const entry of currentUsers) {
        if (entry.startsWith(userPrefix)) {
            await redisClient.sRem(redisSetKey, entry);
        }
    }

    const remaining = (await redisClient.sMembers(redisSetKey)) as string[];

    if (remaining.length === 0) {
        const interval = activeWalletIntervals.get(walletKey);
        if (interval) {
            clearInterval(interval);
            activeWalletIntervals.delete(walletKey);
        }

        await redisClient.del(intervalKey);
        console.log(`🔴 Stopped monitoring ${wallet_address}`);
    }
};

export const resumeAllWalletMonitors = async () => {
    const keys = await redisClient.keys("wallet:MONITOR:*");

    for (const redisSetKey of keys) {
        const walletKey = redisSetKey.replace("wallet:MONITOR:", "");
        const intervalKey = `wallet:INTERVAL_ACTIVE:${walletKey}`;

        const userEntries = (await redisClient.sMembers(redisSetKey)) as string[];
        const hasEnabledUser = userEntries.some((entry) => entry.endsWith(":true"));

        if (hasEnabledUser && !activeWalletIntervals.has(walletKey)) {
            const interval = setInterval(() => {
                pollForNewTrades(walletKey);
            }, 5000);

            activeWalletIntervals.set(walletKey, interval);
            await redisClient.set(intervalKey, "1");
            console.log(`🔁 Resumed monitoring for ${walletKey}`);
        } else if (!hasEnabledUser && activeWalletIntervals.has(walletKey)) {
            const interval = activeWalletIntervals.get(walletKey);
            if (interval) {
                clearInterval(interval);
                activeWalletIntervals.delete(walletKey);
                await redisClient.del(intervalKey);
                console.log(`⏹️ Stopped orphan monitor for ${walletKey}`);
            }
        }
    }

    console.log("✅ Wallet monitoring resumed based on Redis state.");
};

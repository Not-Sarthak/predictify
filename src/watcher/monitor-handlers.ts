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

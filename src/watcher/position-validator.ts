import { getUserPositionsFromPolymarket } from "../bot/utils/get-user-positions";
import { db } from "../lib/supabase";
import { redisClient } from "../lib/redis";
import { hasRecentManualTrade } from "../utils/trade-tracker";

interface PositionValidationResult {
    isValid: boolean;
    reason?: string;
    availableSize?: number;
    hasPosition?: boolean;
}

interface TradeRecord {
    walletAddress: string;
    asset: string;
    side: "BUY" | "SELL";
    size: number;
    timestamp: number;
    hash: string;
}

export async function validateSellPosition(
    userWalletAddress: string,
    asset: string,
    requiredSize: number,
    userId?: number
): Promise<PositionValidationResult> {
    try {
        if (userId && (await hasRecentManualTrade(userId, asset, "SELL", 30000))) {
            return {
                isValid: false,
                reason: "Recent manual sell detected - skipping to avoid conflicts",
                hasPosition: false,
            };
        }

        const positions = await getUserPositionsFromPolymarket(userWalletAddress);
        const position = positions?.find((p: any) => p.asset === asset);

        if (!position || position.size === 0) {
            return {
                isValid: false,
                reason: "No position found",
                hasPosition: false,
                availableSize: 0,
            };
        }

        if (position.size < requiredSize) {
            return {
                isValid: false,
                reason: `Insufficient position. Available: ${position.size}, Required: ${requiredSize}`,
                hasPosition: true,
                availableSize: position.size,
            };
        }

        return {
            isValid: true,
            hasPosition: true,
            availableSize: position.size,
        };
    } catch (error) {
        console.error("Error Validating Sell Position:", error);
        return {
            isValid: false,
            reason: "Failed to validate position",
        };
    }
}

export async function isTradeAlreadyProcessed(userId: number, tradeHash: string): Promise<boolean> {
    try {
        const { data } = await db("Auto_Trade")
            .select("id", "status")
            .eq("user_id", userId)
            .eq("original_trade_hash", tradeHash)
            .limit(1);

        if (data && data.length > 0) {
            return data[0].status === "executed" || data[0].status === "pending";
        }

        const redisKey = `processed_trade:${userId}:${tradeHash}`;
        const exists = await redisClient.exists(redisKey);

        return exists === 1;
    } catch (error) {
        const redisKey = `processed_trade:${userId}:${tradeHash}`;
        const exists = await redisClient.exists(redisKey);
        return exists === 1;
    }
}

export async function markTradeAsProcessed(userId: number, tradeHash: string): Promise<void> {
    const redisKey = `processed_trade:${userId}:${tradeHash}`;
    await redisClient.set(redisKey, "1", { EX: 7 * 24 * 60 * 60 });
}

export async function isSelfCopyAttempt(
    userId: number,
    targetWalletAddress: string
): Promise<boolean> {
    try {
        const { data: user } = await db("Users").select("wallet_address").eq("id", userId).single();

        if (!user) {
            return false;
        }

        return user.wallet_address.toLowerCase() === targetWalletAddress.toLowerCase();
    } catch (error) {
        return false;
    }
}

export async function getUserRecentTrades(
    userId: number,
    asset: string,
    timeWindowMs: number = 60000
): Promise<TradeRecord[]> {
    const redisKey = `user_trades:${userId}:${asset}`;
    const recentTrades = await redisClient.get(redisKey);

    if (recentTrades) {
        const trades: TradeRecord[] = JSON.parse(recentTrades);
        const cutoffTime = Date.now() - timeWindowMs;
        return trades.filter((trade) => trade.timestamp > cutoffTime);
    }

    return [];
}

export async function recordUserTrade(
    userId: number,
    trade: Omit<TradeRecord, "timestamp">
): Promise<void> {
    const redisKey = `user_trades:${userId}:${trade.asset}`;
    const existingTrades = await getUserRecentTrades(userId, trade.asset, 3600000);

    const newTrade: TradeRecord = {
        ...trade,
        timestamp: Date.now(),
    };

    const updatedTrades = [...existingTrades, newTrade];

    await redisClient.set(redisKey, JSON.stringify(updatedTrades), { EX: 7200 });
}

export async function hasActiveCopyTrade(userId: number, asset: string): Promise<boolean> {
    const lockKey = `copytrade_lock:${userId}:${asset}`;
    const lock = await redisClient.get(lockKey);
    return lock !== null;
}

export async function setCopyTradeLock(
    userId: number,
    asset: string,
    durationMs: number = 30000
): Promise<boolean> {
    const lockKey = `copytrade_lock:${userId}:${asset}`;
    const result = await redisClient.set(lockKey, "1", { NX: true, PX: durationMs });
    return result === "OK";
}

export async function releaseCopyTradeLock(userId: number, asset: string): Promise<void> {
    const lockKey = `copytrade_lock:${userId}:${asset}`;
    await redisClient.del(lockKey);
}

export async function validateBuyOrder(
    userId: number,
    asset: string,
    walletAddress: string
): Promise<PositionValidationResult> {
    if (await isSelfCopyAttempt(userId, walletAddress)) {
        return {
            isValid: false,
            reason: "Cannot copy trade your own wallet",
        };
    }

    if (await hasActiveCopyTrade(userId, asset)) {
        return {
            isValid: false,
            reason: "Another copy trade is in progress for this market",
        };
    }

    if (await hasRecentManualTrade(userId, asset, "BUY", 30000)) {
        return {
            isValid: false,
            reason: "Recent manual buy detected - skipping to avoid duplicate purchases",
        };
    }

    return {
        isValid: true,
    };
}

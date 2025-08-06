import { redisClient } from "../lib/redis";

interface ManualTradeRecord {
    userId: number;
    asset: string;
    side: "BUY" | "SELL";
    size: number;
    timestamp: number;
    isManual: boolean;
}

export async function trackManualTrade(
    userId: number,
    asset: string,
    side: "BUY" | "SELL",
    size: number
): Promise<void> {
    const trade: ManualTradeRecord = {
        userId,
        asset,
        side,
        size,
        timestamp: Date.now(),
        isManual: true,
    };

    const key = `manual_trades:${userId}:${asset}`;
    const trades = await getRecentManualTrades(userId, asset);

    const oneHourAgo = Date.now() - 3600000;
    const recentTrades = trades.filter((t) => t.timestamp > oneHourAgo);

    recentTrades.push(trade);

    await redisClient.set(key, JSON.stringify(recentTrades), { EX: 7200 });
}

export async function getRecentManualTrades(
    userId: number,
    asset: string
): Promise<ManualTradeRecord[]> {
    const key = `manual_trades:${userId}:${asset}`;
    const data = await redisClient.get(key);

    if (!data) {
        return [];
    }

    try {
        return JSON.parse(data);
    } catch {
        return [];
    }
}

export async function hasRecentManualTrade(
    userId: number,
    asset: string,
    side: "BUY" | "SELL",
    windowMs: number = 60000
): Promise<boolean> {
    const trades = await getRecentManualTrades(userId, asset);
    const cutoff = Date.now() - windowMs;

    return trades.some(
        (trade) => trade.side === side && trade.timestamp > cutoff && trade.isManual
    );
}

export async function clearManualTradeHistory(userId: number, asset: string): Promise<void> {
    const key = `manual_trades:${userId}:${asset}`;
    await redisClient.del(key);
}

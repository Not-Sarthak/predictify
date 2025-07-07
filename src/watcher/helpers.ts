import { env } from "@/config";
import { getUserDetails } from "@/helpers/get-user-details";
import { redisClient } from "@/lib/redis";
import { decryptPrivateKey } from "@/utils/crypto";
import { marketBuyOrder } from "@/utils/polymarket-order/market-buy-order";
import { OrderType, Side } from "@polymarket/clob-client";
import axios from "axios";

interface Trade {
    proxyWallet: string;
    side: "BUY" | "SELL";
    asset: string;
    conditionId: string;
    size: number;
    price: number;
    timestamp: number;
    title: string;
    outcome: string;
    transactionHash: string;
}

interface FormattedTrade {
    walletAddress: string;
    market: string;
    side: "BUY" | "SELL";
    asset: string;
    conditionId: string;
    outcome: string;
    size: number;
    price: number;
    value: number;
    hash: string;
    timestamp: string;
}

// Track the latest timestamp in memory per wallet
const lastTimestamps = new Map<string, number>();

export const pollForNewTrades = async (walletAddress: string) => {
    let lastTimestamp = lastTimestamps.get(walletAddress);
    if (!lastTimestamp) {
        lastTimestamp = await getInitialTimestamp(walletAddress);
        lastTimestamps.set(walletAddress, lastTimestamp);
    }

    const allTrades = await fetchTrades(walletAddress);
    const newTrades = filterNewTrades(allTrades!, lastTimestamp);
    if (newTrades.length === 0) return;

    const redisSetKey = `wallet:MONITOR:${walletAddress.toLowerCase()}`;
    const userEntries = await redisClient.sMembers(redisSetKey);

    for (const trade of newTrades) {
        const formatted = formatTradeInfo(trade, walletAddress);

        for (const entry of userEntries) {
            const [userId, isEnabledRaw] = entry.split(":");
            const isEnabled = isEnabledRaw === "true";

            if (isEnabled) await executeTrade(userId, formatted);
            else {
                await notifyUser(
                    userId,
                    `🔥 *New Trade Detected* from *${walletAddress}*\nMarket: ${formatted.market}\nSide: ${formatted.side}\nSize: ${formatted.size}\nPrice: ${formatted.price}`
                );
            }
        }
    }

    lastTimestamps.set(walletAddress, getLatestTimestamp(newTrades));
};

export const fetchTrades = async (
    walletAddress: string,
    limit: number = 100
): Promise<Trade[] | null> => {
    try {
        const response = await axios.get("https://data-api.polymarket.com/trades", {
            params: {
                user: walletAddress,
                limit,
                takerOnly: true,
            },
        });
        return response.data || [];
    } catch (error) {
        console.error(`Failed to fetch trades: ${error}`);
        return null;
    }
};

export const formatTradeInfo = (trade: Trade, walletAddress: string): FormattedTrade => ({
    walletAddress,
    market: trade.title,
    side: trade.side,
    asset: trade.asset,
    conditionId: trade.conditionId,
    outcome: trade.outcome,
    size: trade.size,
    price: trade.price,
    value: trade.size * trade.price,
    hash: trade.transactionHash,
    timestamp: new Date(trade.timestamp * 1000).toISOString(),
});

export const filterNewTrades = (trades: Trade[], lastTimestamp: number): Trade[] =>
    trades.filter((trade) => trade.timestamp > lastTimestamp);

export const getLatestTimestamp = (trades: Trade[]): number =>
    trades.length > 0 ? Math.max(...trades.map((t) => t.timestamp)) : 0;

export const getInitialTimestamp = async (walletAddress: string): Promise<number> => {
    try {
        const trades = await fetchTrades(walletAddress, 1);
        return trades!.length > 0 ? trades![0].timestamp : Math.floor(Date.now() / 1000);
    } catch (error) {
        console.error(`Failed to Get Initial Timestamp: ${error}`);
        return Math.floor(Date.now() / 1000);
    }
};

export const executeTrade = async (userId: string, trade: FormattedTrade) => {
    const user = await getUserDetails(Number(userId));

    if (!user) return;

    try {
        if (!user.is_copytrading_enabled) return;

        const amount = trade.size * trade.price * Number(user.config_value);

        await marketBuyOrder({
            privateKey: decryptPrivateKey(user.private_key),
            creds: JSON.parse(user.api_credentials),
            tokenId: trade.asset,
            amount,
            side: trade.side === "BUY" ? Side.BUY : Side.SELL,
            orderType: OrderType.FOK,
        });

        const redisKey = `copytrade:executed:${userId}:${Date.now()}`;
        await redisClient.set(
            redisKey,
            JSON.stringify({
                userId,
                market: trade.market,
                side: trade.side,
                size: trade.size,
                price: trade.price,
                value: amount,
                timestamp: new Date().toISOString(),
            }),
            { EX: 60 * 60 * 24 } // expire in 24 hours
        );

        return notifyUser(
            userId,
            `✅ *CopyTrade Order Executed Successfully!*
*Market:* ${trade.market}
*Side:* ${trade.side}
*Size:* ${trade.size}
*Price:* ${trade.price}
*Value:* ${(trade.size * trade.price).toFixed(4)}`
        );
    } catch (error) {
        console.error("❌ Error placing market order:", error);

        const errorKey = `copytrade:error:${userId}:${Date.now()}`;
        await redisClient.set(
            errorKey,
            JSON.stringify({
                trade,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString(),
            }),
            { EX: 60 * 60 * 6 } // 6-hour TTL
        );

        await notifyUser(
            userId,
            `❌ *CopyTrade Order Execution Failed*
*Market:* ${trade.market}
*Side:* ${trade.side}
*Size:* ${trade.size}
*Price:* ${trade.price}
*Value:* ${(trade.size * trade.price).toFixed(4)}

*Reason:* ${error instanceof Error ? error.message : String(error)}`
        );
    }
};

const notifyUser = async (telegramUserId: string, message: string) => {
    const botToken = env.TG_BOT_TOKEN;

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const body = {
        chat_id: telegramUserId,
        text: message,
        parse_mode: "Markdown",
    };

    try {
        await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
    } catch (error) {
        console.error("❌ Failed to send Telegram message:", error);
    }
};

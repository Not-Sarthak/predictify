import { env } from "@/config";
import { getUserDetails } from "@/helpers/get-user-details";
import { redisClient } from "@/lib/redis";
import { decryptPrivateKey } from "@/utils/crypto";
import { marketBuyOrder, marketSellOrder } from "@/utils/polymarket-order/market-buy-order";
import { OrderType, Side } from "@polymarket/clob-client";
import axios from "axios";
import { getUserPositionsFromPolymarket } from "@/bot/utils/get-user-positions";
import { db } from "@/lib/supabase";

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

        // Check for circular trading
        // If the trade is from wallet A, check if wallet A is copying the current user's wallet
        const { data: circularCheck } = await db("Copy_Wallets")
            .select("*")
            .eq("wallet_address", user.wallet_address)
            .eq("is_enabled", true);

        if (circularCheck && circularCheck.length > 0) {
            // Get the user who owns the wallet that initiated this trade
            const { data: tradeInitiator } = await db("Users")
                .select("id")
                .eq("wallet_address", trade.walletAddress)
                .single();

            if (tradeInitiator) {
                // Check if any of the users copying the current user's wallet is the trade initiator
                const isCircular = circularCheck.some((copy) => copy.user_id === tradeInitiator.id);

                if (isCircular) {
                    console.log(
                        `Circular trade detected: User ${userId} and wallet ${trade.walletAddress} are copying each other. Skipping trade.`
                    );

                    await notifyUser(
                        userId,
                        `⚠️ *Circular Trade Detected*\n\n` +
                            `The wallet you're copying (${trade.walletAddress}) is also copying your wallet.\n` +
                            `This trade has been skipped to prevent infinite loops.\n\n` +
                            `*Market:* ${trade.market}\n` +
                            `*Side:* ${trade.side}`
                    );

                    return;
                }
            }
        }

        // trade.size is already adjusted by position percentage in copy-trade.ts
        // trade.value is also already calculated correctly
        const amount = trade.value; // This is the USD amount to spend

        console.log(`Executing trade for user ${userId}:`, {
            tokenId: trade.asset,
            amount,
            side: trade.side,
            shares: trade.size,
            price: trade.price,
        });

        if (trade.side === "BUY") {
            await marketBuyOrder({
                privateKey: decryptPrivateKey(user.private_key),
                creds: JSON.parse(user.api_credentials),
                tokenId: trade.asset,
                amount, // USD amount to spend
                side: Side.BUY,
                orderType: OrderType.FOK,
            });
        } else {
            // Check if user has position before selling
            const userPositions = await getUserPositionsFromPolymarket(user.wallet_address);
            const position = userPositions?.find((p: any) => p.asset === trade.asset);

            if (!position || position.size < trade.size) {
                const availableSize = position?.size || 0;
                throw new Error(
                    `Insufficient position. Available: ${availableSize}, Required: ${trade.size}`
                );
            }

            await marketSellOrder({
                privateKey: decryptPrivateKey(user.private_key),
                creds: JSON.parse(user.api_credentials),
                tokenId: trade.asset,
                amount: trade.size, // number of shares to sell
                orderType: OrderType.FOK,
            });
        }

        const redisKey = `copytrade:executed:${userId}:${Date.now()}`;
        await redisClient.set(
            redisKey,
            JSON.stringify({
                userId,
                market: trade.market,
                side: trade.side,
                shares: trade.size,
                price: trade.price,
                value: trade.value,
                timestamp: new Date().toISOString(),
            }),
            { EX: 60 * 60 * 24 } // expire in 24 hours
        );

        return notifyUser(
            userId,
            `✅ *CopyTrade Order Executed Successfully!*
*Market:* ${trade.market}
*Side:* ${trade.side}
*Shares:* ${trade.size.toFixed(2)}
*Price:* ${trade.price.toFixed(4)}
*Value:* ${trade.value.toFixed(4)} USDC`
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
*Shares:* ${trade.size.toFixed(2)}
*Price:* ${trade.price.toFixed(4)}
*Value:* ${trade.value.toFixed(4)} USDC

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

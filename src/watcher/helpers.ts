import { env } from "../config";
import { getUserDetails } from "../helpers/get-user-details";
import { redisClient } from "../lib/redis";
import { decryptPrivateKey } from "../utils/crypto";
import { marketBuyOrder, marketSellOrder } from "../utils/polymarket-order/market-buy-order";
import { OrderType, Side } from "@polymarket/clob-client";
import axios from "axios";
import { db } from "../lib/supabase";
import {
    validateSellPosition,
    isTradeAlreadyProcessed,
    markTradeAsProcessed,
    isSelfCopyAttempt,
    setCopyTradeLock,
    releaseCopyTradeLock,
} from "./position-validator";
import {
    updateUserMarketsTraded,
    updateUserTransactionsExecuted,
} from "../bot/utils/database/update-user-data";

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
    originalSize?: number;
    originalValue?: number;
}

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
        console.error(`Failed To Fetch Trades: ${error}`);
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
        console.error(`Failed To Get Initial Timestamp: ${error}`);
        return Math.floor(Date.now() / 1000);
    }
};

export const executeTrade = async (userId: string, trade: FormattedTrade) => {
    const user = await getUserDetails(Number(userId));

    if (!user) return;

    let lockAcquired = false;

    try {
        if (!user.is_copytrading_enabled) return;

        if (await isTradeAlreadyProcessed(Number(userId), trade.hash)) {
            console.log(`Trade ${trade.hash} Already Processed For User ${userId}`);
            return;
        }

        await markTradeAsProcessed(Number(userId), trade.hash);

        if (await isSelfCopyAttempt(Number(userId), trade.walletAddress)) {
            throw new Error("Cannot copy trade your own wallet");
        }

        const { data: circularCheck } = await db("Copy_Wallets")
            .select("*")
            .eq("wallet_address", user.wallet_address)
            .eq("is_enabled", true);

        if (circularCheck && circularCheck.length > 0) {
            const { data: tradeInitiator } = await db("Users")
                .select("id")
                .eq("wallet_address", trade.walletAddress)
                .single();

            if (tradeInitiator) {
                const isCircular = circularCheck.some((copy) => copy.user_id === tradeInitiator.id);

                if (isCircular) {
                    console.log(
                        `Circular Trade Detected: User ${userId} And Wallet ${trade.walletAddress} Are Copying Each Other`
                    );

                    throw new Error("Circular trade detected - wallets are copying each other");
                }
            }
        }

        lockAcquired = await setCopyTradeLock(Number(userId), trade.asset);
        if (!lockAcquired) {
            console.log(`Concurrent Trade In Progress For User ${userId}`);
            return;
        }

        const amount = parseFloat(trade.value.toFixed(6));

        if (trade.side === "BUY") {
            // The order helpers return their failure instead of throwing
            const { error } = await marketBuyOrder({
                privateKey: decryptPrivateKey(user.private_key),
                creds: JSON.parse(user.api_credentials),
                tokenId: trade.asset,
                amount,
                side: Side.BUY,
                orderType: OrderType.FOK,
            });
            if (error) throw error instanceof Error ? error : new Error(String(error));

            await Promise.all([
                updateUserMarketsTraded(Number(userId)),
                updateUserTransactionsExecuted(Number(userId)),
            ]);
        } else {
            const validation = await validateSellPosition(
                user.wallet_address,
                trade.asset,
                trade.size,
                Number(userId)
            );

            if (!validation.isValid) {
                if (!validation.hasPosition) {
                    throw new Error(validation.reason);
                } else if (validation.availableSize! < trade.size) {
                    const availableSize = validation.availableSize!;
                    await notifyUser(
                        userId,
                        `ℹ️ Copy Trade Adjusted\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                            `Reason: Partial Position Available\n` +
                            `Original Size: ${trade.originalSize ? trade.originalSize.toFixed(4) : trade.size.toFixed(4)} shares\n` +
                            `Available: ${availableSize.toFixed(4)} shares\n` +
                            `Selling available amount only.`
                    );
                    trade.size = availableSize;
                }
            }

            const { error } = await marketSellOrder({
                privateKey: decryptPrivateKey(user.private_key),
                creds: JSON.parse(user.api_credentials),
                tokenId: trade.asset,
                amount: trade.size,
                orderType: OrderType.FOK,
            });
            if (error) throw error instanceof Error ? error : new Error(String(error));
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
            { EX: 60 * 60 * 24 }
        );

        return notifyUser(
            userId,
            `✅ Copy Trade Executed Successfully!\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `📋 Target Wallet Order Details\n` +
                `Market: ${trade.market}\n` +
                `Side: ${trade.side}\n` +
                `Size: ${trade.originalSize ? trade.originalSize.toFixed(4) : trade.size.toFixed(4)} shares\n` +
                `Price: $${trade.price.toFixed(4)}\n` +
                `Value: $${trade.originalValue ? trade.originalValue.toFixed(2) : trade.value.toFixed(2)} USDC\n` +
                `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `💼 My Wallet Order Details\n` +
                `Market: ${trade.market}\n` +
                `Side: ${trade.side}\n` +
                `Size: ${trade.size.toFixed(4)} shares\n` +
                `Price: $${trade.price.toFixed(4)}\n` +
                `Value: $${trade.value.toFixed(2)} USDC`
        );
    } catch (error) {
        console.error(`Copy Trade Error For User ${userId}:`, error);

        const errorKey = `copytrade:error:${userId}:${Date.now()}`;
        await redisClient.set(
            errorKey,
            JSON.stringify({
                trade,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString(),
            }),
            { EX: 60 * 60 * 6 }
        );

        const errorMessage = error instanceof Error ? error.message : String(error);
        let emoji = "⚠️";
        let title = "Copy Trade Skipped";

        if (
            errorMessage.toLowerCase().includes("insufficient balance") ||
            errorMessage.toLowerCase().includes("api error") ||
            errorMessage.toLowerCase().includes("network")
        ) {
            emoji = "❌";
            title = "Copy Trade Failed";
        }

        await notifyUser(
            userId,
            `${emoji} ${title}\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `Reason: ${errorMessage}\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `Market: ${trade.market}\n` +
                `Side: ${trade.side}\n` +
                `Size: ${trade.size.toFixed(4)} shares\n` +
                `Price: $${trade.price.toFixed(4)}\n` +
                `Value: $${trade.value.toFixed(2)} USDC`
        );
    } finally {
        // Only release a lock this call holds; otherwise it would free a concurrent trade's lock
        if (lockAcquired) await releaseCopyTradeLock(Number(userId), trade.asset);
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
        console.error("Failed To Send Telegram Message:", error);
    }
};

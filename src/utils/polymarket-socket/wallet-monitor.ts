import { getUserDetails } from "@/helpers/get-user-details";
import { redisClient } from "@/lib/redis";
import { marketBuyOrder } from "@/utils/polymarket-order/market-buy-order";
import { OrderType, Side } from "@polymarket/clob-client";
import axios from "axios";
import { env } from "bun";

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

interface WalletMonitorConfig {
    walletAddress: string;
    pollIntervalMs: number;
}

interface MonitorState {
    lastTimestamp: number;
    isRunning: boolean;
    intervalId?: NodeJS.Timeout;
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

const activeMonitors = new Map<string, MonitorState>();

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

export const fetchTrades = async (walletAddress: string, limit: number = 100): Promise<Trade[]> => {
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
        throw new Error(`Failed to fetch trades: ${error}`);
    }
};

export const getInitialTimestamp = async (walletAddress: string): Promise<number> => {
    try {
        const trades = await fetchTrades(walletAddress, 1);
        return trades.length > 0 ? trades[0].timestamp : Math.floor(Date.now() / 1000);
    } catch (error) {
        console.error(`Failed to Get Initial Timestamp: ${error}`);
        return Math.floor(Date.now() / 1000);
    }
};

const startWalletMonitoring = async (
    config: WalletMonitorConfig,
    onNewTrade: (trade: FormattedTrade) => void,
    onError?: (error: Error) => void
): Promise<MonitorState> => {
    const state: MonitorState = {
        lastTimestamp: await getInitialTimestamp(config.walletAddress),
        isRunning: true,
        intervalId: undefined,
    };

    const monitoringLoop = async (): Promise<void> => {
        try {
            const trades = await fetchTrades(config.walletAddress);
            const newTrades = filterNewTrades(trades, state.lastTimestamp);

            if (newTrades.length > 0) {
                state.lastTimestamp = getLatestTimestamp(newTrades);

                newTrades.reverse().forEach((trade) => {
                    const formattedTrade = formatTradeInfo(trade, config.walletAddress);
                    onNewTrade(formattedTrade);
                });
            }
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            if (onError) {
                onError(err);
            } else {
                console.error("❌ Wallet Monitor Error:", err.message);
            }
        }
    };

    state.intervalId = setInterval(monitoringLoop, config.pollIntervalMs);
    return state;
};

const stopWalletMonitoring = (state: MonitorState): void => {
    if (state.intervalId) {
        clearInterval(state.intervalId);
        state.intervalId = undefined;
    }
    state.isRunning = false;
};

export const onTradeDetected = async (trade: FormattedTrade, userId: string) => {
    console.log("🔥 New Trade Detected:", trade);
    const user = await getUserDetails(Number(userId));

    if (!user) return;

    try {
        if (user.is_copytrading_enabled) {
            const amount = trade.size * trade.price * Number(user.config_value);

            await marketBuyOrder({
                privateKey: user.private_key,
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

            return sendTelegramMessage(
                userId,
                `✅ *Order Executed Successfully!*
*Market:* ${trade.market}
*Side:* ${trade.side}
*Size:* ${trade.size}
*Price:* ${trade.price}
*Value:* ${(trade.size * trade.price).toFixed(4)}`
            );
        }

        await sendTelegramMessage(
            userId,
            `🔥 *New Trade Detected*\nMarket: ${trade.market}\nSide: ${trade.side}\nSize: ${trade.size}\nPrice: ${trade.price}`
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

        await sendTelegramMessage(
            userId,
            `❌ *Order Execution Failed*
*Market:* ${trade.market}
*Side:* ${trade.side}
*Size:* ${trade.size}
*Price:* ${trade.price}
*Value:* ${(trade.size * trade.price).toFixed(4)}

*Reason:* ${error instanceof Error ? error.message : String(error)}`
        );
    }
};

export const onMonitorError: (error: Error, walletAddress: string) => void = (
    error: Error,
    walletAddress: string
) => {
    console.error(`❌ Monitor Error For ${walletAddress}:`, error.message);
};

export const startMonitor = async (
    walletAddresses: Array<[string, string]>,
    pollIntervalMs: number = 3000
): Promise<void> => {
    if (walletAddresses.length > 3) {
        throw new Error("Maximum 3 Wallets Allowed");
    }

    for (const [userId, walletAddress] of walletAddresses) {
        if (activeMonitors.has(walletAddress)) {
            console.log(`Already Monitoring Wallet: ${walletAddress}`);
            continue;
        }

        const config: WalletMonitorConfig = {
            walletAddress,
            pollIntervalMs,
        };

        const onTradeWithUser = async (trade: FormattedTrade) => {
            await onTradeDetected(trade, userId);
        };

        try {
            const state = await startWalletMonitoring(config, onTradeWithUser, (error) =>
                onMonitorError(error, walletAddress)
            );
            activeMonitors.set(walletAddress, state);
            console.log(`✅ Started Monitoring Wallet: ${walletAddress}`);
        } catch (error) {
            console.error(`Failed to Start Monitoring ${walletAddress}:`, error);
        }
    }
};

export const stopMonitor = (walletAddresses: string[]): void => {
    for (const walletAddress of walletAddresses) {
        const state = activeMonitors.get(walletAddress);
        if (state) {
            stopWalletMonitoring(state);
            activeMonitors.delete(walletAddress);
            console.log(`🛑 Stopped Monitoring Wallet: ${walletAddress}`);
        } else {
            console.log(`Wallet Not Being Monitored: ${walletAddress}`);
        }
    }
};

export const getMonitoredWallets = (): string[] => {
    return Array.from(activeMonitors.keys());
};

export const stopAllMonitors = (): void => {
    const walletAddresses = Array.from(activeMonitors.keys());
    stopMonitor(walletAddresses);
};

const sendTelegramMessage = async (telegramUserId: string, message: string) => {
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

export type { Trade, WalletMonitorConfig, MonitorState, FormattedTrade };

// Usage:
// import { startMonitor, stopMonitor, onTradeDetected, onMonitorError } from './wallet-monitor';

// Override default handlers
// onTradeDetected = (trade) => {
//     console.log("New trade:", trade);
//     // Your copy trading logic here
//     // io.emit('newTrade', trade); // for socket server
// };

// onMonitorError = (error, walletAddress) => {
//     console.error(`Error monitoring ${walletAddress}:`, error.message);
//     // io.emit('monitorError', { walletAddress, error: error.message });
// };

// Start monitoring (max 3 addresses)
// await startMonitor([["user_id", "wallet_address"]]);

// Stop monitoring
// stopMonitor(["0xaddress1", "0xaddress2"]);

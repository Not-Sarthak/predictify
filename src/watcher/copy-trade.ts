import axios from "axios";
import { redisClient as redis } from "../lib/redis";
import { supabase } from "../lib/supabase";
import { bot } from "../bot";
import { executeTrade } from "./helpers";
import { handleCopyTradeError } from "./trade-error-handler";

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

interface WalletSubscription {
    userId: number;
    isCopyTradingEnabled: boolean;
    positionPercentage: number;
}

interface WalletMonitor {
    walletAddress: string;
    lastTimestamp: number;
    seenTrades: Set<string>;
    subscribers: WalletSubscription[];
    pollInterval: NodeJS.Timeout | null;
    retryCount: number;
}

// Shared state for all wallet monitors
const monitors: Map<string, WalletMonitor> = new Map();
const POLL_INTERVAL = 5000; // 5 seconds
const MAX_RETRY_DELAY = 60000; // 1 minute
const BASE_RETRY_DELAY = 1000; // 1 second

// Pure functions
const createWalletSubscription = (
    userId: number,
    isCopyTradingEnabled: boolean,
    positionPercentage: number
): WalletSubscription => ({
    userId,
    isCopyTradingEnabled,
    positionPercentage,
});

const createWalletMonitor = (walletAddress: string): WalletMonitor => ({
    walletAddress,
    lastTimestamp: Math.floor(Date.now() / 1000),
    seenTrades: new Set(),
    subscribers: [],
    pollInterval: null,
    retryCount: 0,
});

const shouldProcessTrade = (trade: Trade, monitor: WalletMonitor): boolean => {
    return (
        trade.timestamp > monitor.lastTimestamp && !monitor.seenTrades.has(trade.transactionHash)
    );
};

const calculateRetryDelay = (retryCount: number): number => {
    return Math.min(BASE_RETRY_DELAY * Math.pow(2, retryCount), MAX_RETRY_DELAY);
};

const initializeSeenTrades = async (walletAddress: string): Promise<Set<string>> => {
    const seenTrades = new Set<string>();

    try {
        const response = await axios.get("https://data-api.polymarket.com/trades", {
            params: {
                user: walletAddress,
                limit: 100,
                takerOnly: true,
            },
        });

        if (response.data && Array.isArray(response.data)) {
            response.data.forEach((trade: Trade) => {
                seenTrades.add(trade.transactionHash);
            });
        }
    } catch (error) {
        console.error(`Failed To Initialize Seen Trades For ${walletAddress}:`, error);
    }

    return seenTrades;
};

const fetchTrades = async (walletAddress: string, limit: number = 20): Promise<Trade[]> => {
    const response = await axios.get("https://data-api.polymarket.com/trades", {
        params: {
            user: walletAddress,
            limit,
            takerOnly: true,
        },
        timeout: 5000,
    });

    return response.data || [];
};

const processTrade = async (trade: Trade, subscribers: WalletSubscription[]) => {
    const copyTradingUsers = subscribers.filter((sub) => sub.isCopyTradingEnabled);
    const notificationOnlyUsers = subscribers.filter((sub) => !sub.isCopyTradingEnabled);

    const copyTradePromises = copyTradingUsers.map(async (sub) => {
        try {
            await executeCopyTrade(trade, sub);
        } catch (error) {
            console.error(`Copy Trade Failed For User ${sub.userId}:`, error);
            await recordFailedTrade(sub.userId, trade, error, sub.positionPercentage);
        }
    });

    const notificationPromises = notificationOnlyUsers.map(async (sub) => {
        try {
            await sendTradeNotification(sub.userId, trade);
        } catch (error) {
            console.error(`Failed To Send Notification To User ${sub.userId}:`, error);
        }
    });

    await Promise.all([...copyTradePromises, ...notificationPromises]);
};

const executeCopyTrade = async (trade: Trade, subscription: WalletSubscription) => {
    const { data: user } = await supabase
        .from("Users")
        .select("*")
        .eq("id", subscription.userId)
        .single();

    if (!user) {
        throw new Error("User not found");
    }

    if (!subscription.positionPercentage || subscription.positionPercentage === 0) {
        await bot.telegram.sendMessage(
            subscription.userId,
            `⚠️ Copy Trade Skipped\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `Reason: Position Percentage Not Set\n\n` +
                `Please configure your position percentage:\n` +
                `/autotrade → Configure → Set position percentage`
        );
        throw new Error("Position percentage not configured");
    }

    const copySize = parseFloat(((trade.size * subscription.positionPercentage) / 100).toFixed(6));

    const formattedTrade: FormattedTrade = {
        walletAddress: trade.proxyWallet,
        market: trade.title,
        side: trade.side,
        asset: trade.asset,
        conditionId: trade.conditionId,
        outcome: trade.outcome,
        size: copySize,
        price: trade.price,
        value: copySize * trade.price,
        hash: trade.transactionHash,
        timestamp: new Date(trade.timestamp * 1000).toISOString(),
        originalSize: trade.size,
        originalValue: trade.size * trade.price,
    };

    try {
        await executeTrade(subscription.userId.toString(), formattedTrade);

        await supabase.from("Auto_Trade").insert({
            user_id: subscription.userId,
            watched_wallet: trade.proxyWallet,
            original_trade_hash: trade.transactionHash,
            copied_trade_hash: trade.transactionHash,
            market_id: trade.asset,
            market_title: trade.title,
            outcome: trade.outcome,
            side: trade.side,
            original_size: trade.size,
            original_price: trade.price,
            copied_size: copySize,
            copied_price: trade.price,
            position_percentage: subscription.positionPercentage,
            status: "executed",
            original_timestamp: new Date(trade.timestamp * 1000).toISOString(),
            executed_at: new Date().toISOString(),
        });
    } catch (error: any) {
        throw error;
    }
};

const recordFailedTrade = async (
    userId: number,
    trade: Trade,
    error: any,
    positionPercentage: number = 0
) => {
    await handleCopyTradeError({
        userId,
        trade: {
            walletAddress: trade.proxyWallet,
            transactionHash: trade.transactionHash,
            asset: trade.asset,
            title: trade.title,
            outcome: trade.outcome,
            side: trade.side,
            size: trade.size,
            price: trade.price,
        },
        error,
        positionPercentage,
    });
};

const sendTradeNotification = async (userId: number, trade: Trade) => {
    await bot.telegram.sendMessage(
        userId,
        `🔔 New Trade Detected\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `💼 Wallet: ${trade.proxyWallet}\n` +
            `🎯 Market: ${trade.title}\n` +
            `🎲 Outcome: ${trade.outcome}\n` +
            `📊 Side: ${trade.side}\n` +
            `💰 Size: ${trade.size}\n` +
            `💵 Price: ${trade.price}\n` +
            `💸 Value: ${(trade.size * trade.price).toFixed(4)} USDC`
    );
};

const pollWallet = async (monitor: WalletMonitor) => {
    try {
        const trades = await fetchTrades(monitor.walletAddress);
        const newTrades = trades.filter((trade) => shouldProcessTrade(trade, monitor));

        if (newTrades.length > 0) {
            for (const trade of newTrades) {
                await processTrade(trade, monitor.subscribers);
                monitor.seenTrades.add(trade.transactionHash);
            }

            monitor.lastTimestamp = Math.max(...newTrades.map((t) => t.timestamp));

            await saveMonitorState(monitor);
        }

        monitor.retryCount = 0;

        monitor.pollInterval = setTimeout(() => pollWallet(monitor), POLL_INTERVAL);
    } catch (error: any) {
        if (error.response?.status === 429) {
            monitor.retryCount++;
            const delay = calculateRetryDelay(monitor.retryCount);
            console.warn(
                `Rate Limited For Wallet ${monitor.walletAddress}. Retrying In ${delay / 1000}s`
            );
            monitor.pollInterval = setTimeout(() => pollWallet(monitor), delay);
        } else {
            console.error(`Error Polling Wallet ${monitor.walletAddress}:`, error);
            monitor.pollInterval = setTimeout(() => pollWallet(monitor), POLL_INTERVAL);
        }
    }
};

const saveMonitorState = async (monitor: WalletMonitor) => {
    const state = {
        lastTimestamp: monitor.lastTimestamp,
        seenTrades: Array.from(monitor.seenTrades),
    };
    await redis.set(`monitor:${monitor.walletAddress}`, JSON.stringify(state), { EX: 86400 });
};

const loadMonitorState = async (walletAddress: string): Promise<Partial<WalletMonitor> | null> => {
    const state = await redis.get(`monitor:${walletAddress}`);
    if (!state) return null;

    const parsed = JSON.parse(state);
    return {
        lastTimestamp: parsed.lastTimestamp,
        seenTrades: new Set(parsed.seenTrades),
    };
};

export const startWalletMonitoring = async (
    walletAddress: string,
    userId: number,
    isCopyTradingEnabled: boolean,
    positionPercentage: number = 100
) => {
    let monitor = monitors.get(walletAddress);

    if (!monitor) {
        monitor = createWalletMonitor(walletAddress);

        const savedState = await loadMonitorState(walletAddress);
        if (savedState) {
            monitor.lastTimestamp = savedState.lastTimestamp || monitor.lastTimestamp;
            monitor.seenTrades = savedState.seenTrades || monitor.seenTrades;
        } else {
            monitor.seenTrades = await initializeSeenTrades(walletAddress);
        }

        monitors.set(walletAddress, monitor);

        pollWallet(monitor);

        console.log(`Started Monitoring Wallet ${walletAddress}`);
    }

    const existingIndex = monitor.subscribers.findIndex((sub) => sub.userId === userId);
    const subscription = createWalletSubscription(userId, isCopyTradingEnabled, positionPercentage);

    if (existingIndex >= 0) {
        monitor.subscribers[existingIndex] = subscription;
    } else {
        monitor.subscribers.push(subscription);
    }
};

export const stopWalletMonitoring = async (walletAddress: string, userId: number) => {
    const monitor = monitors.get(walletAddress);
    if (!monitor) return;

    monitor.subscribers = monitor.subscribers.filter((sub) => sub.userId !== userId);

    if (monitor.subscribers.length === 0) {
        if (monitor.pollInterval) {
            clearTimeout(monitor.pollInterval);
        }
        monitors.delete(walletAddress);
        console.log(`Stopped Monitoring Wallet ${walletAddress}`);
    }
};

export const updateSubscription = async (
    walletAddress: string,
    userId: number,
    isCopyTradingEnabled: boolean,
    positionPercentage: number
) => {
    const monitor = monitors.get(walletAddress);
    if (!monitor) return;

    const subscription = monitor.subscribers.find((sub) => sub.userId === userId);
    if (subscription) {
        subscription.isCopyTradingEnabled = isCopyTradingEnabled;
        subscription.positionPercentage = positionPercentage;
    }
};

export const getMonitoringStatus = () => {
    const status = Array.from(monitors.entries()).map(([wallet, monitor]) => ({
        wallet,
        subscriberCount: monitor.subscribers.length,
        copyTradingCount: monitor.subscribers.filter((s) => s.isCopyTradingEnabled).length,
        lastActivity: new Date(monitor.lastTimestamp * 1000),
    }));

    return {
        totalWallets: monitors.size,
        totalSubscribers: status.reduce((sum, s) => sum + s.subscriberCount, 0),
        wallets: status,
    };
};

export const getUserMonitoringStatus = (userId: number) => {
    const userWallets: Array<{
        wallet: string;
        isCopyTradingEnabled: boolean;
        positionPercentage: number;
        lastActivity: Date;
    }> = [];

    monitors.forEach((monitor, walletAddress) => {
        const subscription = monitor.subscribers.find((sub) => sub.userId === userId);
        if (subscription) {
            userWallets.push({
                wallet: walletAddress,
                isCopyTradingEnabled: subscription.isCopyTradingEnabled,
                positionPercentage: subscription.positionPercentage,
                lastActivity: new Date(monitor.lastTimestamp * 1000),
            });
        }
    });

    return {
        userId,
        monitoredWallets: userWallets,
        totalWallets: userWallets.length,
    };
};

export const resumeAllMonitoring = async () => {
    const { data: users } = await supabase
        .from("Users")
        .select("id, watched_wallets, is_copytrading_enabled, config_value")
        .not("watched_wallets", "is", null);

    if (!users || users.length === 0) {
        console.log("No Users With Watched Wallets");
        return;
    }

    for (const user of users) {
        if (user.watched_wallets && user.watched_wallets.length > 0) {
            const positionPercentage = user.config_value ? parseInt(user.config_value) : 100;

            for (const walletAddress of user.watched_wallets) {
                const { data: wallet } = await supabase
                    .from("Copy_Wallets")
                    .select("is_enabled")
                    .eq("user_id", user.id)
                    .eq("wallet_address", walletAddress)
                    .single();

                if (wallet?.is_enabled) {
                    await startWalletMonitoring(
                        walletAddress,
                        user.id,
                        user.is_copytrading_enabled,
                        positionPercentage
                    );
                }
            }
        }
    }

    console.log(`Resumed Monitoring For ${monitors.size} Wallets`);
};

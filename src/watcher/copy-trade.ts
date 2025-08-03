import axios from "axios";
import { redisClient as redis } from "@/lib/redis";
import { supabase } from "@/lib/supabase";
import { executeTrade } from "./helpers";
import { bot } from "@/bot";

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

// Initialize seen trades for a wallet
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
        console.error(`Failed to initialize seen trades for ${walletAddress}:`, error);
    }

    return seenTrades;
};

// Fetch trades for a wallet
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

// Process a single trade for all subscribers
const processTrade = async (trade: Trade, subscribers: WalletSubscription[]) => {
    const copyTradingUsers = subscribers.filter((sub) => sub.isCopyTradingEnabled);
    const notificationOnlyUsers = subscribers.filter((sub) => !sub.isCopyTradingEnabled);

    // Execute copy trades in parallel
    const copyTradePromises = copyTradingUsers.map(async (sub) => {
        try {
            await executeCopyTrade(trade, sub);
        } catch (error) {
            console.error(`Failed to execute copy trade for user ${sub.userId}:`, error);
            await recordFailedTrade(sub.userId, trade, error);
        }
    });

    // Send notifications in parallel
    const notificationPromises = notificationOnlyUsers.map(async (sub) => {
        try {
            await sendTradeNotification(sub.userId, trade);
        } catch (error) {
            console.error(`Failed to send notification to user ${sub.userId}:`, error);
        }
    });

    await Promise.all([...copyTradePromises, ...notificationPromises]);
};

// Execute a copy trade
const executeCopyTrade = async (trade: Trade, subscription: WalletSubscription) => {
    const { data: user } = await supabase
        .from("Users")
        .select("*")
        .eq("id", subscription.userId)
        .single();

    if (!user) {
        throw new Error("User not found");
    }

    // Check if user has set position percentage
    if (!subscription.positionPercentage || subscription.positionPercentage === 0) {
        await bot.telegram.sendMessage(
            subscription.userId,
            "⚠️ Copy trade detected but position percentage not set!\n\n" +
                "Please go to:\n" +
                "/autotrade → Configure → Set your position percentage\n\n" +
                "Trade details:\n" +
                `Market: ${trade.title}\n` +
                `Side: ${trade.side}\n` +
                `Size: ${trade.size}\n` +
                `Price: ${trade.price}`
        );
        throw new Error("Position percentage not configured");
    }

    // Calculate copy trade size
    const copySize = (trade.size * subscription.positionPercentage) / 100;

    // Format trade for executeTrade function
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
    };

    try {
        // Execute the trade using the helper function
        console.log(`Executing copy trade for user ${subscription.userId}:`, {
            market: formattedTrade.market,
            side: formattedTrade.side,
            size: formattedTrade.size,
            price: formattedTrade.price,
        });

        const result = await executeTrade(subscription.userId.toString(), formattedTrade);
        console.log(`Copy trade execution result for user ${subscription.userId}:`, result);

        // Record successful trade
        await supabase.from("Auto_Trade").insert({
            user_id: subscription.userId,
            watched_wallet: trade.proxyWallet,
            original_trade_hash: trade.transactionHash,
            copied_trade_hash: trade.transactionHash, // We don't have the copied hash from executeTrade
            market_id: trade.asset,
            market_title: trade.title,
            outcome: trade.outcome,
            side: trade.side,
            original_size: trade.size,
            original_price: trade.price,
            copied_size: copySize,
            copied_price: trade.price, // Same price for market orders
            position_percentage: subscription.positionPercentage,
            status: "executed",
            original_timestamp: new Date(trade.timestamp * 1000).toISOString(),
            executed_at: new Date().toISOString(),
        });

        // Send success notification
        await bot.telegram.sendMessage(
            subscription.userId,
            `✅ Copy trade executed!\n` +
                `Market: ${trade.title}\n` +
                `Outcome: ${trade.outcome}\n` +
                `Side: ${trade.side}\n` +
                `Original Size: ${trade.size}\n` +
                `Your Size: ${copySize} (${subscription.positionPercentage}%)\n` +
                `Price: ${trade.price}\n` +
                `Original Value: ${(trade.size * trade.price).toFixed(4)} USDC\n` +
                `Your Value: ${(copySize * trade.price).toFixed(4)} USDC`
        );
    } catch (error: any) {
        // Log the error but handle specific cases
        if (error.message?.includes("no match")) {
            await bot.telegram.sendMessage(
                subscription.userId,
                `⚠️ Copy trade could not be executed - insufficient market liquidity\n\n` +
                    `Market: ${trade.title}\n` +
                    `Side: ${trade.side}\n` +
                    `Attempted size: ${copySize}\n\n` +
                    `The market doesn't have enough liquidity for this order size.`
            );

            // Record as failed trade
            await supabase.from("Auto_Trade").insert({
                user_id: subscription.userId,
                watched_wallet: trade.proxyWallet,
                original_trade_hash: trade.transactionHash,
                market_id: trade.asset,
                market_title: trade.title,
                outcome: trade.outcome,
                side: trade.side,
                original_size: trade.size,
                original_price: trade.price,
                copied_size: copySize,
                position_percentage: subscription.positionPercentage,
                status: "failed",
                error_message: "Insufficient market liquidity",
                original_timestamp: new Date(trade.timestamp * 1000).toISOString(),
            });
        } else if (error.message?.includes("Insufficient position")) {
            await bot.telegram.sendMessage(
                subscription.userId,
                `⚠️ Copy trade could not be executed - insufficient position\n\n` +
                    `Market: ${trade.title}\n` +
                    `Side: ${trade.side}\n` +
                    `Attempted to sell: ${copySize} shares\n\n` +
                    `You don't have enough shares of this outcome to sell.\n` +
                    `Please check your positions at /trade`
            );

            // Record as failed trade
            await supabase.from("Auto_Trade").insert({
                user_id: subscription.userId,
                watched_wallet: trade.proxyWallet,
                original_trade_hash: trade.transactionHash,
                market_id: trade.asset,
                market_title: trade.title,
                outcome: trade.outcome,
                side: trade.side,
                original_size: trade.size,
                original_price: trade.price,
                copied_size: copySize,
                position_percentage: subscription.positionPercentage,
                status: "failed",
                error_message: error.message,
                original_timestamp: new Date(trade.timestamp * 1000).toISOString(),
            });
        } else if (error.message?.includes("not enough balance")) {
            await bot.telegram.sendMessage(
                subscription.userId,
                `⚠️ Copy trade could not be executed - insufficient balance\n\n` +
                    `Market: ${trade.title}\n` +
                    `Side: ${trade.side}\n` +
                    `Required: ${(copySize * trade.price).toFixed(4)} USDC\n\n` +
                    `Please ensure you have enough USDC in your wallet.\n` +
                    `Check your balance at /fund`
            );

            // Record as failed trade
            await supabase.from("Auto_Trade").insert({
                user_id: subscription.userId,
                watched_wallet: trade.proxyWallet,
                original_trade_hash: trade.transactionHash,
                market_id: trade.asset,
                market_title: trade.title,
                outcome: trade.outcome,
                side: trade.side,
                original_size: trade.size,
                original_price: trade.price,
                copied_size: copySize,
                position_percentage: subscription.positionPercentage,
                status: "failed",
                error_message: "Insufficient balance",
                original_timestamp: new Date(trade.timestamp * 1000).toISOString(),
            });
        }
        throw error;
    }
};

// Record failed trade
const recordFailedTrade = async (userId: number, trade: Trade, error: any) => {
    await supabase.from("Auto_Trade").insert({
        user_id: userId,
        watched_wallet: trade.proxyWallet,
        original_trade_hash: trade.transactionHash,
        market_id: trade.asset,
        market_title: trade.title,
        outcome: trade.outcome,
        side: trade.side,
        original_size: trade.size,
        original_price: trade.price,
        position_percentage: 0,
        status: "failed",
        error_message: error.message || "Unknown error",
        original_timestamp: new Date(trade.timestamp * 1000).toISOString(),
    });
};

// Send trade notification
const sendTradeNotification = async (userId: number, trade: Trade) => {
    await bot.telegram.sendMessage(
        userId,
        `🔔 New trade detected!\n` +
            `Wallet: ${trade.proxyWallet}\n` +
            `Market: ${trade.title}\n` +
            `Outcome: ${trade.outcome}\n` +
            `Side: ${trade.side}\n` +
            `Size: ${trade.size}\n` +
            `Price: ${trade.price}\n` +
            `Value: ${(trade.size * trade.price).toFixed(4)} USDC`
    );
};

// Poll for new trades
const pollWallet = async (monitor: WalletMonitor) => {
    try {
        const trades = await fetchTrades(monitor.walletAddress);
        const newTrades = trades.filter((trade) => shouldProcessTrade(trade, monitor));

        if (newTrades.length > 0) {
            // Process trades sequentially to maintain order
            for (const trade of newTrades) {
                await processTrade(trade, monitor.subscribers);
                monitor.seenTrades.add(trade.transactionHash);
            }

            // Update last timestamp
            monitor.lastTimestamp = Math.max(...newTrades.map((t) => t.timestamp));

            // Save state to Redis
            await saveMonitorState(monitor);
        }

        // Reset retry count on success
        monitor.retryCount = 0;

        // Schedule next poll
        monitor.pollInterval = setTimeout(() => pollWallet(monitor), POLL_INTERVAL);
    } catch (error: any) {
        if (error.response?.status === 429) {
            // Rate limited - use exponential backoff
            monitor.retryCount++;
            const delay = calculateRetryDelay(monitor.retryCount);
            console.warn(
                `Rate limited for wallet ${monitor.walletAddress}. Retrying in ${delay / 1000}s`
            );
            monitor.pollInterval = setTimeout(() => pollWallet(monitor), delay);
        } else {
            console.error(`Error polling wallet ${monitor.walletAddress}:`, error);
            monitor.pollInterval = setTimeout(() => pollWallet(monitor), POLL_INTERVAL);
        }
    }
};

// Save monitor state to Redis
const saveMonitorState = async (monitor: WalletMonitor) => {
    const state = {
        lastTimestamp: monitor.lastTimestamp,
        seenTrades: Array.from(monitor.seenTrades),
    };
    await redis.set(`monitor:${monitor.walletAddress}`, JSON.stringify(state), { EX: 86400 }); // 24 hour expiry
};

// Load monitor state from Redis
const loadMonitorState = async (walletAddress: string): Promise<Partial<WalletMonitor> | null> => {
    const state = await redis.get(`monitor:${walletAddress}`);
    if (!state) return null;

    const parsed = JSON.parse(state);
    return {
        lastTimestamp: parsed.lastTimestamp,
        seenTrades: new Set(parsed.seenTrades),
    };
};

// Public API

// Start monitoring a wallet for a user
export const startWalletMonitoring = async (
    walletAddress: string,
    userId: number,
    isCopyTradingEnabled: boolean,
    positionPercentage: number = 100
) => {
    let monitor = monitors.get(walletAddress);

    if (!monitor) {
        // Create new monitor
        monitor = createWalletMonitor(walletAddress);

        // Try to load previous state
        const savedState = await loadMonitorState(walletAddress);
        if (savedState) {
            monitor.lastTimestamp = savedState.lastTimestamp || monitor.lastTimestamp;
            monitor.seenTrades = savedState.seenTrades || monitor.seenTrades;
        } else {
            // Initialize seen trades
            monitor.seenTrades = await initializeSeenTrades(walletAddress);
        }

        monitors.set(walletAddress, monitor);

        // Start polling
        pollWallet(monitor);

        console.log(`Started monitoring wallet ${walletAddress}`);
    }

    // Add or update subscriber
    const existingIndex = monitor.subscribers.findIndex((sub) => sub.userId === userId);
    const subscription = createWalletSubscription(userId, isCopyTradingEnabled, positionPercentage);

    if (existingIndex >= 0) {
        monitor.subscribers[existingIndex] = subscription;
    } else {
        monitor.subscribers.push(subscription);
    }

    console.log(`User ${userId} subscribed to wallet ${walletAddress}`);
};

// Stop monitoring a wallet for a user
export const stopWalletMonitoring = async (walletAddress: string, userId: number) => {
    const monitor = monitors.get(walletAddress);
    if (!monitor) return;

    // Remove subscriber
    monitor.subscribers = monitor.subscribers.filter((sub) => sub.userId !== userId);

    // If no more subscribers, stop monitoring
    if (monitor.subscribers.length === 0) {
        if (monitor.pollInterval) {
            clearTimeout(monitor.pollInterval);
        }
        monitors.delete(walletAddress);
        console.log(`Stopped monitoring wallet ${walletAddress}`);
    }
};

// Update user's subscription settings
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

// Get monitoring status
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

// Get monitoring status for a specific user
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

// Resume monitoring on startup
export const resumeAllMonitoring = async () => {
    // Get all users with watched wallets
    const { data: users } = await supabase
        .from("Users")
        .select("id, watched_wallets, is_copytrading_enabled, config_value")
        .not("watched_wallets", "is", null);

    if (!users || users.length === 0) {
        console.log("No users with watched wallets");
        return;
    }

    // Resume monitoring for each user's watched wallets
    for (const user of users) {
        if (user.watched_wallets && user.watched_wallets.length > 0) {
            const positionPercentage = user.config_value ? parseInt(user.config_value) : 100;

            for (const walletAddress of user.watched_wallets) {
                // Check if wallet is enabled in Copy_Wallets table
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

    console.log(`Resumed monitoring for ${monitors.size} wallets`);
};

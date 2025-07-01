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

export let onTradeDetected: (trade: FormattedTrade) => void = (trade: FormattedTrade) => {
    console.log("🔥 New Trade Detected:", trade);
    // TODO: Add Copy Trading Logic Here
};

export let onMonitorError: (error: Error, walletAddress: string) => void = (
    error: Error,
    walletAddress: string
) => {
    console.error(`❌ Monitor Error For ${walletAddress}:`, error.message);
};

export const startMonitor = async (
    walletAddresses: string[],
    pollIntervalMs: number = 3000
): Promise<void> => {
    if (walletAddresses.length > 3) {
        throw new Error("Maximum 3 Wallets Allowed");
    }

    for (const walletAddress of walletAddresses) {
        if (activeMonitors.has(walletAddress)) {
            console.log(`Already Monitoring Wallet: ${walletAddress}`);
            continue;
        }

        const config: WalletMonitorConfig = {
            walletAddress,
            pollIntervalMs,
        };

        try {
            const state = await startWalletMonitoring(config, onTradeDetected, (error) =>
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

export type { Trade, WalletMonitorConfig, MonitorState, FormattedTrade };

/*
// Usage:
import { startMonitor, stopMonitor, onTradeDetected, onMonitorError } from './wallet-monitor';

// Override default handlers
onTradeDetected = (trade) => {
  console.log('New trade:', trade);
  // Your copy trading logic here
  // io.emit('newTrade', trade); // for socket server
};

onMonitorError = (error, walletAddress) => {
  console.error(`Error monitoring ${walletAddress}:`, error.message);
  // io.emit('monitorError', { walletAddress, error: error.message });
};

// Start monitoring (max 3 addresses)
await startMonitor(['0xaddress1', '0xaddress2', '0xaddress3']);

// Stop monitoring
stopMonitor(['0xaddress1', '0xaddress2']);
*/

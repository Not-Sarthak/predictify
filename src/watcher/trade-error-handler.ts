import { bot } from "../bot";
import { db } from "../lib/supabase";

export enum CopyTradeErrorType {
    INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
    INSUFFICIENT_POSITION = "INSUFFICIENT_POSITION",
    NO_POSITION = "NO_POSITION",
    MARKET_LIQUIDITY = "MARKET_LIQUIDITY",
    CIRCULAR_TRADE = "CIRCULAR_TRADE",
    SELF_COPY = "SELF_COPY",
    DUPLICATE_TRADE = "DUPLICATE_TRADE",
    POSITION_PERCENTAGE_NOT_SET = "POSITION_PERCENTAGE_NOT_SET",
    TRADE_LOCK_FAILED = "TRADE_LOCK_FAILED",
    API_ERROR = "API_ERROR",
    UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

interface TradeErrorDetails {
    userId: number;
    trade: {
        walletAddress: string;
        transactionHash: string;
        asset: string;
        title: string;
        outcome: string;
        side: string;
        size: number;
        price: number;
    };
    error: Error;
    errorType?: CopyTradeErrorType;
    positionPercentage?: number;
}

export async function handleCopyTradeError(details: TradeErrorDetails): Promise<void> {
    const { userId, trade, error, positionPercentage = 0 } = details;
    const errorType = determineErrorType(error.message);

    console.error(`Copy Trade Error For User ${userId}:`, {
        errorType,
        message: error.message,
        trade: {
            market: trade.title,
            side: trade.side,
            size: trade.size,
        },
    });

    const notification = getErrorNotification(errorType, trade, error.message);
    if (notification) {
        await bot.telegram.sendMessage(userId, notification, { parse_mode: "Markdown" });
    }

    await recordFailedTrade(userId, trade, errorType, error.message, positionPercentage);
}

function determineErrorType(errorMessage: string): CopyTradeErrorType {
    const message = errorMessage.toLowerCase();

    if (message.includes("insufficient balance") || message.includes("not enough balance")) {
        return CopyTradeErrorType.INSUFFICIENT_BALANCE;
    }
    if (message.includes("insufficient position")) {
        return CopyTradeErrorType.INSUFFICIENT_POSITION;
    }
    if (message.includes("no position")) {
        return CopyTradeErrorType.NO_POSITION;
    }
    if (message.includes("no match") || message.includes("liquidity")) {
        return CopyTradeErrorType.MARKET_LIQUIDITY;
    }
    if (message.includes("circular")) {
        return CopyTradeErrorType.CIRCULAR_TRADE;
    }
    if (message.includes("self-copy") || message.includes("own wallet")) {
        return CopyTradeErrorType.SELF_COPY;
    }
    if (message.includes("already processed") || message.includes("duplicate")) {
        return CopyTradeErrorType.DUPLICATE_TRADE;
    }
    if (message.includes("position percentage")) {
        return CopyTradeErrorType.POSITION_PERCENTAGE_NOT_SET;
    }
    if (message.includes("lock")) {
        return CopyTradeErrorType.TRADE_LOCK_FAILED;
    }
    if (message.includes("api") || message.includes("network")) {
        return CopyTradeErrorType.API_ERROR;
    }

    return CopyTradeErrorType.UNKNOWN_ERROR;
}

function getErrorNotification(
    errorType: CopyTradeErrorType,
    trade: any,
    errorMessage: string
): string | null {
    switch (errorType) {
        case CopyTradeErrorType.INSUFFICIENT_BALANCE:
            return `Copy Trade Skipped - Insufficient Balance`;

        case CopyTradeErrorType.NO_POSITION:
            return `Copy Trade Skipped - No Position`;

        case CopyTradeErrorType.INSUFFICIENT_POSITION:
            return null;

        case CopyTradeErrorType.MARKET_LIQUIDITY:
            return `Copy Trade Skipped - Market Liquidity`;

        case CopyTradeErrorType.CIRCULAR_TRADE:
        case CopyTradeErrorType.SELF_COPY:
        case CopyTradeErrorType.DUPLICATE_TRADE:
            return null;

        case CopyTradeErrorType.POSITION_PERCENTAGE_NOT_SET:
            return `Copy Trade Skipped - Position Percentage Not Set`;

        case CopyTradeErrorType.TRADE_LOCK_FAILED:
            return `Copy Trade Skipped - Concurrent Trade`;

        case CopyTradeErrorType.API_ERROR:
            return `Copy Trade Skipped - API Error`;

        case CopyTradeErrorType.UNKNOWN_ERROR:
        default:
            return `Copy Trade Skipped - ${errorMessage}`;
    }
}

async function recordFailedTrade(
    userId: number,
    trade: any,
    errorType: CopyTradeErrorType,
    errorMessage: string,
    positionPercentage: number = 0
): Promise<void> {
    try {
        await db("Auto_Trade").insert({
            user_id: userId,
            watched_wallet: trade.walletAddress,
            original_trade_hash: trade.transactionHash,
            market_id: trade.asset,
            market_title: trade.title,
            outcome: trade.outcome,
            side: trade.side,
            original_size: trade.size,
            original_price: trade.price,
            position_percentage: positionPercentage,
            status: "failed",
            error_message: `[${errorType}] ${errorMessage}`,
            original_timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Failed To Record Failed Trade:", error);
    }
}

export function isRetryableError(errorType: CopyTradeErrorType): boolean {
    return [
        CopyTradeErrorType.API_ERROR,
        CopyTradeErrorType.TRADE_LOCK_FAILED,
        CopyTradeErrorType.MARKET_LIQUIDITY,
    ].includes(errorType);
}

export function getRetryDelay(errorType: CopyTradeErrorType, attemptNumber: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds

    switch (errorType) {
        case CopyTradeErrorType.TRADE_LOCK_FAILED:
            return Math.min(baseDelay * attemptNumber, 5000); // Max 5 seconds
        case CopyTradeErrorType.API_ERROR:
            return Math.min(baseDelay * Math.pow(2, attemptNumber), maxDelay); // Exponential Backoff
        case CopyTradeErrorType.MARKET_LIQUIDITY:
            return 10000; // Fixed 10 second delay
        default:
            return 0; // No retry
    }
}

import type { PriceWatchConfig } from "./price-watcher";

const EPSILON = 0.00001;

interface BookSnapshot {
    asks?: unknown;
    bids?: unknown;
}

interface TriggerResult {
    shouldTrigger: boolean;
    currentPrice?: number;
    lastBestAsk: number | null;
}

export function bestPrice(levels: unknown, pick: (...values: number[]) => number) {
    if (!Array.isArray(levels)) return undefined;

    const prices = levels.map((level: any) => parseFloat(level?.price)).filter(isFinite);
    return prices.length ? pick(...prices) : undefined;
}

export function evaluateTrigger(
    config: PriceWatchConfig,
    book: BookSnapshot,
    lastBestAsk: number | null
): TriggerResult {
    const { type, price } = config;

    if (type === "alert") {
        // Alerts fire when the ask touches or crosses the level, from either side
        const currentPrice = bestPrice(book.asks, Math.min);
        if (currentPrice === undefined) return { shouldTrigger: false, lastBestAsk };

        const shouldTrigger =
            lastBestAsk === null
                ? Math.abs(currentPrice - price) < EPSILON
                : (lastBestAsk - price) * (currentPrice - price) <= 0;

        return { shouldTrigger, currentPrice, lastBestAsk: currentPrice };
    }

    // TP/SL sell into the bids, and are level-based so a move that happened while the bot
    // was down still triggers on the first book after a restore
    const currentPrice = bestPrice(book.bids, Math.max);
    if (currentPrice === undefined) return { shouldTrigger: false, lastBestAsk };

    const shouldTrigger = type === "take_profit" ? currentPrice >= price : currentPrice <= price;

    return { shouldTrigger, currentPrice, lastBestAsk };
}

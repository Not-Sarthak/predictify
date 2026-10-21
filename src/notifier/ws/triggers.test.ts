import { describe, expect, test } from "bun:test";
import { bestPrice, evaluateTrigger } from "./triggers";

const book = (asks: string[], bids: string[]) => ({
    asks: asks.map((price) => ({ price, size: "100" })),
    bids: bids.map((price) => ({ price, size: "100" })),
});

describe("bestPrice", () => {
    test("picks the lowest ask and the highest bid", () => {
        const { asks, bids } = book(["0.62", "0.60", "0.65"], ["0.55", "0.58", "0.50"]);

        expect(bestPrice(asks, Math.min)).toBe(0.6);
        expect(bestPrice(bids, Math.max)).toBe(0.58);
    });

    test("ignores malformed levels and handles an empty side", () => {
        expect(bestPrice([{ price: "abc" }, null, { price: "0.4" }], Math.min)).toBe(0.4);
        expect(bestPrice([], Math.min)).toBeUndefined();
        expect(bestPrice(undefined, Math.min)).toBeUndefined();
    });
});

describe("price alerts", () => {
    const alert = { type: "alert", price: 0.5, outcome: "yes" } as const;

    test("fires when the ask jumps past the level without touching it", () => {
        const first = evaluateTrigger(alert, book(["0.48"], []), null);
        expect(first.shouldTrigger).toBe(false);

        const second = evaluateTrigger(alert, book(["0.53"], []), first.lastBestAsk);
        expect(second.shouldTrigger).toBe(true);
    });

    test("fires when the price falls through the level", () => {
        const result = evaluateTrigger(alert, book(["0.47"], []), 0.52);
        expect(result.shouldTrigger).toBe(true);
    });

    test("does not fire while the price stays on one side", () => {
        const result = evaluateTrigger(alert, book(["0.45"], []), 0.47);
        expect(result.shouldTrigger).toBe(false);
        expect(result.lastBestAsk).toBe(0.45);
    });

    test("keeps the previous ask when the book has no asks", () => {
        const result = evaluateTrigger(alert, book([], ["0.40"]), 0.47);
        expect(result.shouldTrigger).toBe(false);
        expect(result.lastBestAsk).toBe(0.47);
    });
});

describe("take profit and stop loss", () => {
    const takeProfit = { type: "take_profit", price: 0.7, outcome: "yes", size: 50 } as const;
    const stopLoss = { type: "stop_loss", price: 0.3, outcome: "yes", size: 100 } as const;

    test("trigger off the best bid, not the ask", () => {
        const askAboveTarget = evaluateTrigger(takeProfit, book(["0.72"], ["0.66"]), null);
        expect(askAboveTarget.shouldTrigger).toBe(false);

        const bidAtTarget = evaluateTrigger(takeProfit, book(["0.72"], ["0.70"]), null);
        expect(bidAtTarget.shouldTrigger).toBe(true);
        expect(bidAtTarget.currentPrice).toBe(0.7);
    });

    test("a stop loss fires on the first book when the price gapped down while offline", () => {
        const result = evaluateTrigger(stopLoss, book(["0.27"], ["0.25"]), null);
        expect(result.shouldTrigger).toBe(true);
    });

    test("a stop loss does not fire above its level", () => {
        const result = evaluateTrigger(stopLoss, book(["0.36"], ["0.34"]), null);
        expect(result.shouldTrigger).toBe(false);
    });

    test("does nothing when the book has no bids", () => {
        const result = evaluateTrigger(stopLoss, book(["0.20"], []), null);
        expect(result.shouldTrigger).toBe(false);
    });
});

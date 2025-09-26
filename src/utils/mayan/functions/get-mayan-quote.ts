import { fetchQuote } from "@mayanfinance/swap-sdk";
import type { MayanBridgeInput, Quote } from "../types";

export async function getMayanQuote(params: MayanBridgeInput): Promise<Quote> {
    try {
        const quoteParams = {
            amountIn64: params.amountIn64,
            fromToken: params.fromToken,
            toToken: params.toToken,
            fromChain: params.fromChain,
            toChain: params.toChain,
            slippageBps: params.slippageBps,
            gasDrop: params.gasDrop || 0,
            referrer: params.referrer,
            referrerBps: params.referrerBps || 0,
        };

        const quotes = await fetchQuote(quoteParams);

        if (!quotes || quotes.length === 0) {
            throw new Error("No quotes available for this bridge");
        }

        // Return the best quote (first one is usually the best)
        return quotes[0];
    } catch (error) {
        console.error("Error fetching Mayan quote:", error);
        throw new Error(
            `Failed to get bridge quote: ${error instanceof Error ? error.message : "Unknown error"}`
        );
    }
}

import axios from "axios";
import type { Market } from "../../utils/polymarket/get-markets";
import {
    filterHighProbabilityMarkets,
    type HighProbFilters,
    type HighProbMarket,
    DEFAULT_HIGH_PROB_FILTERS,
} from "./market-filters";

/**
 * Fetches markets from Polymarket API with high probability focus
 */
export async function fetchHighProbabilityMarkets(
    filters: HighProbFilters = DEFAULT_HIGH_PROB_FILTERS,
    limit: number = 50
): Promise<HighProbMarket[]> {
    const BASE_URL = "https://gamma-api.polymarket.com/events/pagination";

    const timeFilterHours = filters.timeFilter === "24h" ? 24 : 48;
    const now = new Date();
    const endOfWindow = new Date(now.getTime() + timeFilterHours * 60 * 60 * 1000);

    const params = new URLSearchParams({
        limit: limit.toString(),
        offset: "0",
        active: "true",
        archived: "false",
        closed: "false",
        order: "volume24hr",
        ascending: "false",
        end_date_min: now.toISOString(),
        end_date_max: endOfWindow.toISOString(),
    });

    try {
        const response = await axios.get(`${BASE_URL}?${params.toString()}`);
        const events = response.data.data || [];

        // Extract all markets from events
        const allMarkets: Market[] = [];
        for (const event of events) {
            if (event.markets && Array.isArray(event.markets)) {
                allMarkets.push(...event.markets);
            }
        }

        // Filter and sort high probability markets
        return filterHighProbabilityMarkets(allMarkets, filters);
    } catch (error) {
        console.error("Error fetching high probability markets:", error);
        return [];
    }
}

/**
 * Fetches detailed order book for liquidity calculation
 */
export async function getMarketLiquidity(tokenIds: string[], userId: string): Promise<number> {
    try {
        // This would require the user's credentials to fetch order book
        // For now, return estimated liquidity based on market data
        // In a real implementation, you'd calculate actual liquidity within 2% spread
        return 0;
    } catch (error) {
        console.error("Error fetching market liquidity:", error);
        return 0;
    }
}

/**
 * Get top high probability markets with pagination
 */
export async function getTopHighProbabilityMarkets(
    filters: HighProbFilters = DEFAULT_HIGH_PROB_FILTERS,
    offset: number = 0,
    limit: number = 10
): Promise<{ markets: HighProbMarket[]; hasMore: boolean }> {
    const allMarkets = await fetchHighProbabilityMarkets(filters, 100);

    const startIndex = offset;
    const endIndex = offset + limit;
    const markets = allMarkets.slice(startIndex, endIndex);
    const hasMore = endIndex < allMarkets.length;

    return { markets, hasMore };
}

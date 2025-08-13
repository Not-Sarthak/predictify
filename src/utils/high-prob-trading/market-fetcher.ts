import axios from "axios";
import type { Market } from "../../utils/polymarket/get-markets";
import {
    filterHighProbabilityMarkets,
    type HighProbFilters,
    type HighProbMarket,
    DEFAULT_HIGH_PROB_FILTERS,
} from "./market-filters";
import { CATEGORY_LIST } from "../../shared/constants";

/**
 * Fetches markets from multiple categories using the correct markets API endpoint
 */
async function fetchMarketsFromCategory(category: string, limit: number = 20): Promise<Market[]> {
    try {
        // Use the correct markets API endpoint instead of events
        const BASE_URL = "https://gamma-api.polymarket.com/markets";

        let categorySlug = category.toLowerCase();
        if (categorySlug === "geo-politics") categorySlug = "geopolitics";

        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: "0",
            active: "true",
            archived: "false",
            closed: "false",
            tag: categorySlug, // Use 'tag' instead of 'tag_slug' for markets endpoint
            order: "volume24hr",
            ascending: "false",
        });

        const response = await axios.get(`${BASE_URL}?${params.toString()}`);
        const markets = response.data.data || response.data || [];

        return markets.slice(0, limit);
    } catch (error) {
        console.error(`❌ Error fetching markets from category ${category}:`, error);
        return [];
    }
}

/**
 * Fetches markets from Polymarket API with high probability focus
 * Now includes all categories to ensure broader market coverage
 */
export async function fetchHighProbabilityMarkets(
    filters: HighProbFilters = DEFAULT_HIGH_PROB_FILTERS,
    limit: number = 50
): Promise<HighProbMarket[]> {
    try {
        // Always exclude crypto - get markets from non-crypto categories only
        const categoriesToFetch = CATEGORY_LIST.filter((cat) => cat !== "Crypto");

        // Fetch markets from different categories in parallel
        const categoryPromises = categoriesToFetch.map((category) =>
            fetchMarketsFromCategory(category, 15)
        );

        const categoryResults = await Promise.all(categoryPromises);

        // Combine all markets
        const allMarkets: Market[] = [];
        for (const markets of categoryResults) {
            allMarkets.push(...markets);
        }

        // Remove duplicates based on market ID
        const uniqueMarkets = allMarkets.filter(
            (market, index, self) => index === self.findIndex((m) => m.id === market.id)
        );

        // Filter and sort high probability markets
        const highProbMarkets = filterHighProbabilityMarkets(uniqueMarkets, filters);

        // Return up to the requested limit
        return highProbMarkets.slice(0, limit);
    } catch (error) {
        console.error("❌ Error fetching high probability markets:", error);
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

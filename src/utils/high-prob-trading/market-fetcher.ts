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
 * Fetches general markets without category filter to ensure broader coverage
 */
async function fetchGeneralMarkets(limit: number = 50): Promise<Market[]> {
    try {
        const BASE_URL = "https://gamma-api.polymarket.com/markets";

        // Calculate minimum end date (2 hours from now to exclude 0DTE)
        const minEndDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: "0",
            active: "true",
            archived: "false",
            closed: "false",
            end_date_min: minEndDate, // Exclude 0DTE markets
            order: "volume24hr",
            ascending: "false",
        });

        // console.log(`🔍 [HIGH-PROB] Fetching general markets (no category filter, min end date: ${minEndDate})`);
        const response = await axios.get(`${BASE_URL}?${params.toString()}`);
        const markets = response.data.data || response.data || [];

        // console.log(`📊 [HIGH-PROB] Found ${markets.length} general markets`);
        return markets;
    } catch (error) {
        console.error(`❌ [HIGH-PROB] Error fetching general markets:`, error);
        return [];
    }
}

/**
 * Fetches markets from multiple categories using the correct markets API endpoint
 */
async function fetchMarketsFromCategory(category: string, limit: number = 20): Promise<Market[]> {
    try {
        // Use the correct markets API endpoint instead of events
        const BASE_URL = "https://gamma-api.polymarket.com/markets";

        let categorySlug = category.toLowerCase();
        if (categorySlug === "geo-politics") categorySlug = "geopolitics";

        // Calculate minimum end date (2 hours from now to exclude 0DTE)
        const minEndDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: "0",
            active: "true",
            archived: "false",
            closed: "false",
            tag: categorySlug, // Use 'tag' instead of 'tag_slug' for markets endpoint
            end_date_min: minEndDate, // Exclude 0DTE markets
            order: "volume24hr",
            ascending: "false",
        });

        // console.log(`🔍 [HIGH-PROB] Fetching markets from category: ${category} (slug: ${categorySlug}), min end date: ${minEndDate}`);
        const response = await axios.get(`${BASE_URL}?${params.toString()}`);
        const markets = response.data.data || response.data || [];

        // console.log(`📊 [HIGH-PROB] Found ${markets.length} markets in category ${category}`);
        return markets.slice(0, limit);
    } catch (error) {
        console.error(`❌ [HIGH-PROB] Error fetching markets from category ${category}:`, error);
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
        // console.log(`🚀 [HIGH-PROB] Starting market fetch with filters:`, {
        //     timeFilter: filters.timeFilter,
        //     tradingMode: filters.tradingMode,
        //     excludeCrypto: filters.excludeCrypto
        // });

        // Fetch from NON-SPORTS and NON-CRYPTO categories only to avoid unnecessary API calls
        const allCategories = [...CATEGORY_LIST].filter(
            (category) => category !== "Sports" && category !== "Crypto"
        );
        // console.log(`📂 [HIGH-PROB] Fetching from filtered categories:`, allCategories);

        // Fetch markets from different categories in parallel
        const categoryPromises = allCategories.map((category) =>
            fetchMarketsFromCategory(category, 20)
        );

        // Also fetch general markets without category filter for broader coverage
        const generalMarketsPromise = fetchGeneralMarkets(100);

        const [generalMarkets, ...categoryResults] = await Promise.all([
            generalMarketsPromise,
            ...categoryPromises,
        ]);

        // Combine all markets
        const allMarkets: Market[] = [...generalMarkets];
        for (const markets of categoryResults) {
            allMarkets.push(...markets);
        }

        // console.log(`📊 [HIGH-PROB] Total markets fetched before deduplication: ${allMarkets.length}`);

        // Remove duplicates based on market ID
        const uniqueMarkets = allMarkets.filter(
            (market, index, self) => index === self.findIndex((m) => m.id === market.id)
        );

        // console.log(`📊 [HIGH-PROB] Unique markets after deduplication: ${uniqueMarkets.length} (pre-filtered for 0DTE and sports)`);

        // Filter and sort high probability markets
        const highProbMarkets = filterHighProbabilityMarkets(uniqueMarkets, filters);

        // console.log(`🎯 [HIGH-PROB] Qualifying markets after filtering: ${highProbMarkets.length}`);

        // Log sample of qualifying markets for debugging

        // Return up to the requested limit
        return highProbMarkets.slice(0, limit);
    } catch (error) {
        console.error("❌ [HIGH-PROB] Error fetching high probability markets:", error);
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

import axios from "axios";
import type { Market } from "../../utils/polymarket/get-markets";
import {
    filterHighProbabilityMarkets,
    type HighProbFilters,
    type HighProbMarket,
    defaultFilters,
} from "./market-filters";
import { CATEGORY_LIST } from "../../shared/constants";

/**
 * Fetches markets using the same logic as the trade command
 * This ensures we get the same market data structure and coverage
 */
async function fetchMarketsLikeTrade(
    category: string = "all",
    limit: number = 50,
    offset: number = 0
): Promise<Market[]> {
    try {
        const BASE_URL = "https://gamma-api.polymarket.com/events/pagination";

        // Handle geo-politics category mapping like trade command
        if (category === "geo-politics") category = "geopolitics";

        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString(),
            active: "true",
            archived: "false",
            closed: "false",
            ascending: "false",
            order: "volume24hr", // Use 24hr volume for high-prob relevance
        });

        // Only add tag_slug if we have a specific category (not "all")
        if (category !== "all") {
            params.set("tag_slug", category);
        }

        const url = `${BASE_URL}?${params.toString()}`;
        const response = await axios.get(url);

        const events = response.data.data || [];

        // Extract individual markets from events (this is the key difference!)
        const markets: Market[] = [];
        for (const event of events) {
            if (event.markets && Array.isArray(event.markets)) {
                // Add each market from the event
                for (const market of event.markets) {
                    // Ensure market has required properties and is active
                    if (market.active && market.acceptingOrders && !market.closed) {
                        markets.push(market);
                    }
                }
            }
        }

        console.log(
            `📊 [HIGH-PROB] Extracted ${markets.length} individual markets from ${events.length} events for category: ${category}`
        );
        return markets;
    } catch (error) {
        console.error(`❌ [HIGH-PROB] Error fetching markets for category ${category}:`, error);
        return [];
    }
}

/**
 * Fetches markets from Polymarket API using the exact same logic as trade command
 * This ensures consistency and proper market coverage
 */
export async function fetchHighProbabilityMarkets(
    filters: HighProbFilters = defaultFilters,
    limit: number = 50
): Promise<HighProbMarket[]> {
    try {
        console.log(`🚀 [HIGH-PROB] Starting market fetch with filters:`, {
            timeFilter: filters.timeFilter,
            tradingMode: filters.tradingMode,
            excludeCrypto: filters.excludeCrypto,
        });

        // Get NON-SPORTS and NON-CRYPTO categories like before
        const targetCategories = [...CATEGORY_LIST].filter(
            (category) => category !== "Sports" && category !== "Crypto"
        );

        // Also fetch from "all" categories to get broader coverage
        const allCategoriesPromise = fetchMarketsLikeTrade("all", 100, 0);

        // Fetch from specific categories in parallel
        const categoryPromises = targetCategories.map((category) =>
            fetchMarketsLikeTrade(category, 30, 0)
        );

        const [allMarkets, ...categoryResults] = await Promise.all([
            allCategoriesPromise,
            ...categoryPromises,
        ]);

        // Combine all markets
        const combinedMarkets: Market[] = [...allMarkets];
        for (const markets of categoryResults) {
            combinedMarkets.push(...markets);
        }

        console.log(
            `📊 [HIGH-PROB] Total markets fetched before deduplication: ${combinedMarkets.length}`
        );

        // Remove duplicates based on market ID (same as before)
        const uniqueMarkets = combinedMarkets.filter(
            (market, index, self) => index === self.findIndex((m) => m.id === market.id)
        );

        console.log(`📊 [HIGH-PROB] Unique markets after deduplication: ${uniqueMarkets.length}`);

        // Filter and sort high probability markets
        const highProbMarkets = filterHighProbabilityMarkets(uniqueMarkets, filters);

        console.log(`🎯 [HIGH-PROB] Qualifying markets after filtering: ${highProbMarkets.length}`);

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
    filters: HighProbFilters = defaultFilters,
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

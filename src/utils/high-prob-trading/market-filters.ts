import type { Market } from "../../utils/polymarket/get-markets";

export interface HighProbMarket extends Market {
    probability: number;
    bestOutcome: "yes" | "no";
    bestPrice: number;
    hoursUntilExpiry: number;
    liquidityWithin2Percent: number;
    expectedReturn: number;
    isCryptoMarket: boolean;
}

export interface HighProbFilters {
    timeFilter: "24h" | "48h";
    minVolume: number;
    minLiquidityWithin2Percent: number;
    minProbability: number;
    maxProbability: number;
    excludeCrypto: boolean;
}

export const DEFAULT_HIGH_PROB_FILTERS: HighProbFilters = {
    timeFilter: "24h",
    minVolume: 70000, // Minimum $70,000 trading volume
    minLiquidityWithin2Percent: 200, // Minimum $200 liquidity within 2% spread
    minProbability: 0.85, // Minimum 85% probability
    maxProbability: 0.95, // Maximum 95% probability
    excludeCrypto: true, // Exclude crypto markets
};

/**
 * Checks if a market is crypto-related based on title and description
 */
export function isCryptoMarket(market: Market): boolean {
    const cryptoKeywords = [
        "bitcoin",
        "btc",
        "ethereum",
        "eth",
        "crypto",
        "cryptocurrency",
        "dogecoin",
        "doge",
        "solana",
        "sol",
        "cardano",
        "ada",
        "polygon",
        "matic",
        "chainlink",
        "link",
        "polkadot",
        "dot",
        "litecoin",
        "ltc",
        "binance",
        "bnb",
        "ripple",
        "xrp",
        "avalanche",
        "avax",
        "cosmos",
        "atom",
        "algorand",
        "algo",
        "price above",
        "price below",
        "hit $",
        "reach $",
        "trading above",
        "trading below",
    ];

    const text = `${market.question} ${market.description}`.toLowerCase();
    return cryptoKeywords.some((keyword) => text.includes(keyword));
}

/**
 * Calculates hours until market expiry
 */
export function calculateHoursUntilExpiry(endDate: string): number {
    const now = new Date();
    const expiry = new Date(endDate);
    const diffMs = expiry.getTime() - now.getTime();
    return Math.max(0, diffMs / (1000 * 60 * 60));
}

/**
 * Estimates liquidity within 2% of current price
 * This is a simplified calculation - in a real implementation,
 * you'd fetch order book data for precise liquidity measurements
 */
export function estimateLiquidityWithin2Percent(market: Market): number {
    // Simplified estimation based on total liquidity
    // Real implementation would analyze order book depth
    const totalLiquidity = market.liquidityClob || market.liquidity || 0;

    // Estimate that ~30% of total liquidity is within 2% spread
    // This is a conservative estimate
    return totalLiquidity * 0.3;
}

/**
 * Calculates expected return after estimated slippage
 */
export function calculateExpectedReturn(
    probability: number,
    investmentAmount: number,
    estimatedSlippage: number = 0.01
): number {
    const adjustedPrice = probability * (1 + estimatedSlippage);
    if (adjustedPrice >= 1) return 0;

    const shares = investmentAmount / adjustedPrice;
    const potentialPayout = shares * 1; // Each share pays $1 if wins
    const expectedPayout = potentialPayout * probability;

    return ((expectedPayout - investmentAmount) / investmentAmount) * 100;
}

/**
 * Converts raw market data to HighProbMarket format
 */
export function convertToHighProbMarket(market: any): HighProbMarket {
    let yesPrice = 0.5;
    let noPrice = 0.5;
    let priceSource = "default";

    // Handle different market data structures
    if (market.outcomePrices) {
        try {
            const outcomes =
                typeof market.outcomePrices === "string"
                    ? JSON.parse(market.outcomePrices)
                    : market.outcomePrices;
            if (Array.isArray(outcomes) && outcomes.length >= 2) {
                yesPrice = parseFloat(outcomes[0]) || 0.5;
                noPrice = parseFloat(outcomes[1]) || 0.5;
                priceSource = "outcomePrices";
            }
        } catch (error) {
            console.warn("Error parsing outcomePrices:", error);
        }
    } else if (market.outcomes && Array.isArray(market.outcomes)) {
        // Alternative structure from events API
        if (market.outcomes.length >= 2) {
            yesPrice = parseFloat(market.outcomes[0]?.price) || 0.5;
            noPrice = parseFloat(market.outcomes[1]?.price) || 0.5;
            priceSource = "outcomes";
        }
    } else if (market.prices && Array.isArray(market.prices)) {
        // Another possible structure
        if (market.prices.length >= 2) {
            yesPrice = parseFloat(market.prices[0]) || 0.5;
            noPrice = parseFloat(market.prices[1]) || 0.5;
            priceSource = "prices";
        }
    }

    const bestOutcome = yesPrice >= noPrice ? "yes" : "no";
    const bestPrice = Math.max(yesPrice, noPrice);
    const probability = bestPrice;
    const hoursUntilExpiry = calculateHoursUntilExpiry(market.endDate);

    // Log some sample conversions for debugging
    if (Math.random() < 0.01) {
        // Log 1% of conversions
        console.log(`🔄 Sample market conversion:`, {
            question: market.question?.substring(0, 50),
            priceSource,
            yesPrice,
            noPrice,
            probability,
            volume: market.volume,
            hoursUntilExpiry,
            active: market.active,
            acceptingOrders: market.acceptingOrders,
        });
    }

    return {
        ...market,
        probability,
        bestOutcome,
        bestPrice,
        hoursUntilExpiry,
        liquidityWithin2Percent: estimateLiquidityWithin2Percent(market),
        expectedReturn: calculateExpectedReturn(probability, 100), // Calculate for $100 investment
        isCryptoMarket: isCryptoMarket(market),
    };
}

/**
 * Filters markets based on high-probability criteria
 */
export function filterHighProbabilityMarkets(
    markets: Market[],
    filters: HighProbFilters = DEFAULT_HIGH_PROB_FILTERS
): HighProbMarket[] {
    console.log(`start filter log ${markets.length} markets with criteria:`, {
        timeFilter: filters.timeFilter,
        minVolume: filters.minVolume,
        minProbability: filters.minProbability,
        maxProbability: filters.maxProbability,
        excludeCrypto: filters.excludeCrypto,
    });

    const timeFilterHours = filters.timeFilter === "24h" ? 24 : 48;
    const filteredCount = {
        timeFilter: 0,
        inactive: 0,
        volume: 0,
        liquidity: 0,
        probability: 0,
        crypto: 0,
        passed: 0,
    };

    const highProbMarkets = markets
        .map(convertToHighProbMarket)
        .filter((market) => {
            // Time filter - more relaxed, allow up to 1.5x the time filter
            if (market.hoursUntilExpiry > timeFilterHours * 1.5) {
                filteredCount.timeFilter++;
                return false;
            }

            // Must be active and accepting orders
            if (!market.active || !market.acceptingOrders || market.closed) {
                filteredCount.inactive++;
                return false;
            }

            // Volume filter - more relaxed
            if ((market.volume || 0) < filters.minVolume) {
                filteredCount.volume++;
                return false;
            }

            // Liquidity filter - more relaxed, or skip if no liquidity data
            if (
                market.liquidityWithin2Percent > 0 &&
                market.liquidityWithin2Percent < filters.minLiquidityWithin2Percent
            ) {
                filteredCount.liquidity++;
                return false;
            }

            // Probability range filter
            if (
                market.probability < filters.minProbability ||
                market.probability > filters.maxProbability
            ) {
                filteredCount.probability++;
                return false;
            }

            // Crypto exclusion filter
            if (filters.excludeCrypto && market.isCryptoMarket) {
                filteredCount.crypto++;
                return false;
            }

            filteredCount.passed++;
            return true;
        })
        .sort((a, b) => {
            // Sort by expected return descending, then by probability descending
            if (Math.abs(a.expectedReturn - b.expectedReturn) > 0.1) {
                return b.expectedReturn - a.expectedReturn;
            }
            return b.probability - a.probability;
        });

    console.log(`filtering results logs:`, {
        total: markets.length,
        filtered_out: {
            timeFilter: filteredCount.timeFilter,
            inactive: filteredCount.inactive,
            volume: filteredCount.volume,
            liquidity: filteredCount.liquidity,
            probability: filteredCount.probability,
            crypto: filteredCount.crypto,
        },
        passed: filteredCount.passed,
        final_count: highProbMarkets.length,
    });

    return highProbMarkets;
}

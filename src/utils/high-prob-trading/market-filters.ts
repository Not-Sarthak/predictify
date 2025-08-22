import type { Market } from "../../utils/polymarket/get-markets";

export interface HighProbMarket extends Market {
    probability: number;
    bestOutcome: "yes" | "no";
    bestPrice: number;
    hoursUntilExpiry: number;
    liquidityWithin2Percent: number;
    expectedReturn: number;
    isCryptoMarket: boolean;
    isSportsMarket: boolean;
}

export interface HighProbFilters {
    timeFilter: "24h" | "48h";
    tradingMode: "normal" | "degen";
    excludeCrypto: boolean; // Now toggleable
}

export const defaultFilters: HighProbFilters = {
    timeFilter: "24h",
    tradingMode: "normal",
    excludeCrypto: false, // Default to including crypto
};

/**
 * Checks if a market is crypto-related based on title and description
 * Uses word boundary matching to avoid false positives like "sol" in "resolve"
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
        "cardano",
        "ada",
        "polygon",
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
    ];

    // Short crypto symbols that need word boundary matching to avoid false positives
    const shortCryptoSymbols = [
        "sol", // Solana - avoid matching in "resolve", "solution", etc.
        "matic", // Polygon - avoid matching in "automatic", "systematic", etc.
    ];

    const text = `${market.question} ${market.description}`.toLowerCase();

    // Check regular crypto keywords (case insensitive substring match)
    const hasRegularCryptoKeyword = cryptoKeywords.some((keyword) => text.includes(keyword));

    // Check short symbols with word boundaries (whole word match only)
    const hasShortCryptoSymbol = shortCryptoSymbols.some((symbol) => {
        const regex = new RegExp(`\\b${symbol}\\b`, "i");
        return regex.test(text);
    });

    return hasRegularCryptoKeyword || hasShortCryptoSymbol;
}

/**
 * Checks if a market is sports-related based on title and description
 */
export function isSportsMarket(market: Market): boolean {
    const sportsKeywords = [
        "football",
        "soccer",
        "basketball",
        "baseball",
        "hockey",
        "tennis",
        "golf",
        "boxing",
        "mma",
        "ufc",
        "nfl",
        "nba",
        "mlb",
        "nhl",
        "fifa",
        "world cup",
        "olympics",
        "premier league",
        "champions league",
        "super bowl",
        "playoffs",
        "tournament",
        "championship",
        "match",
        "game",
        "team",
        "player",
        "score",

        "beat",
        "vs",
        "against",
        // Specific team names
        "manchester",
        "arsenal",
        "chelsea",
        "liverpool",
        "tottenham",
        "city",
        "united",
        "real madrid",
        "barcelona",
        "bayern",
        "juventus",
        "psg",
        "lakers",
        "warriors",
        "celtics",
        "heat",
        "knicks",
        "bulls",
        "yankees",
        "dodgers",
        "red sox",
        "giants",
        "cowboys",
        "patriots",
        "steelers",
        "packers",
        "wnba",
        "west ham", // Add specific team that appeared in our test
    ];

    const text = `${market.question} ${market.description}`.toLowerCase();
    return sportsKeywords.some((keyword) => text.includes(keyword));
}

/**
 * Calculates hours until market expiry
 */
export function calculateHoursUntilExpiry(endDate: string): number {
    const now = new Date();
    const expiry = new Date(endDate);
    const diffMs = expiry.getTime() - now.getTime();
    const hours = Math.max(0, diffMs / (1000 * 60 * 60));

    // Log for debugging time calculations
    if (hours <= 1) {
        console.log(`⏰ [HIGH-PROB] Time calculation:`, {
            endDate,
            now: now.toISOString(),
            expiry: expiry.toISOString(),
            diffMs,
            hours,
        });
    }

    return hours;
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
export function convertToHighProbMarket(market: Market): HighProbMarket {
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
            console.warn("❌ [HIGH-PROB] Error parsing outcomePrices:", error);
        }
    } else if ((market as any).outcomes && Array.isArray((market as any).outcomes)) {
        // Alternative structure from events API
        if ((market as any).outcomes.length >= 2) {
            yesPrice = parseFloat((market as any).outcomes[0]?.price) || 0.5;
            noPrice = parseFloat((market as any).outcomes[1]?.price) || 0.5;
            priceSource = "outcomes";
        }
    } else if ((market as any).prices && Array.isArray((market as any).prices)) {
        // Another possible structure
        if ((market as any).prices.length >= 2) {
            yesPrice = parseFloat((market as any).prices[0]) || 0.5;
            noPrice = parseFloat((market as any).prices[1]) || 0.5;
            priceSource = "prices";
        }
    }

    const bestOutcome = yesPrice >= noPrice ? "yes" : "no";
    const bestPrice = Math.max(yesPrice, noPrice);
    const probability = bestPrice;
    const hoursUntilExpiry = calculateHoursUntilExpiry(market.endDate);

    // Log sample conversions for debugging
    if (probability >= 0.98 || hoursUntilExpiry <= 1) {
        // console.log(`🔄 [HIGH-PROB] Converting problematic market:`, {
        //     question: market.question?.substring(0, 50),
        //     priceSource,
        //     yesPrice,
        //     noPrice,
        //     bestOutcome,
        //     bestPrice,
        //     probability,
        //     probabilityPercent: `${(probability * 100).toFixed(1)}%`,
        //     hoursUntilExpiry: hoursUntilExpiry.toFixed(1),
        //     endDate: market.endDate
        // });
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
        isSportsMarket: isSportsMarket(market),
    };
}

/**
 * Filters markets based on high-probability criteria
 */
export function filterHighProbabilityMarkets(
    markets: Market[],
    filters: HighProbFilters = defaultFilters
): HighProbMarket[] {
    // console.log(`🔍 [HIGH-PROB] Starting filtering process with ${markets.length} markets (pre-filtered for sports, crypto, and 0DTE)`);

    const timeFilterHours = filters.timeFilter === "24h" ? 24 : 48;

    // Dynamic probability range based on trading mode
    const minProbability = filters.tradingMode === "normal" ? 0.6 : 0.8; // Conservative: 60%, Aggressive: 80%
    const maxProbability = filters.tradingMode === "normal" ? 0.9 : 0.95; // Conservative: 90%, Aggressive: 95%

    // console.log(`📊 [HIGH-PROB] Filter criteria:`, {
    //     timeFilterHours,
    //     tradingMode: filters.tradingMode,
    //     minProbability: `${minProbability * 100}%`,
    //     maxProbability: `${maxProbability * 100}%`,
    //     excludeCrypto: filters.excludeCrypto,
    //     note: "Sports, crypto, and 0DTE markets already excluded at API level"
    // });

    const filteredCount = {
        timeFilter: 0,
        inactive: 0,
        probability: 0,
        crypto: 0,
        sports: 0,
        resolved: 0,
        zerodte: 0,
        passed: 0,
    };

    const highProbMarkets = markets
        .map(convertToHighProbMarket)
        .filter((market) => {
            // Add more detailed debugging for problematic markets
            const shouldLog = market.probability >= 0.98 || market.hoursUntilExpiry <= 1;

            if (shouldLog) {
                console.log(
                    `🔍 [HIGH-PROB] Examining problematic market: ${market.question?.substring(0, 50)}...`,
                    {
                        hoursUntilExpiry: market.hoursUntilExpiry,
                        timeFilterHours,
                        probability: market.probability,
                        probabilityPercent: `${(market.probability * 100).toFixed(1)}%`,
                        active: market.active,
                        acceptingOrders: market.acceptingOrders,
                        closed: market.closed,
                        bestOutcome: market.bestOutcome,
                        bestPrice: market.bestPrice,
                    }
                );
            }

            // Exclude very short-term markets (less than 30 minutes remaining)
            // but allow some 0DTE markets that have reasonable time left
            if (market.hoursUntilExpiry <= 0.5) {
                filteredCount.zerodte++;
                // console.log(`❌ [HIGH-PROB] Filtered: Very short-term (${market.hoursUntilExpiry.toFixed(1)}h <= 0.5h)`);
                return false;
            }

            // Time filter - markets expiring within the specified timeframe
            if (market.hoursUntilExpiry > timeFilterHours) {
                filteredCount.timeFilter++;
                // console.log(`❌ [HIGH-PROB] Filtered: Time (${market.hoursUntilExpiry.toFixed(1)}h > ${timeFilterHours}h)`);
                return false;
            }

            // Must be active and accepting orders
            if (!market.active || !market.acceptingOrders || market.closed) {
                filteredCount.inactive++;
                // console.log(`❌ [HIGH-PROB] Filtered: Inactive (active: ${market.active}, accepting: ${market.acceptingOrders}, closed: ${market.closed})`);
                return false;
            }

            // Exclude resolved markets (>=98% probability) - more strict filtering
            if (market.probability >= 0.98) {
                filteredCount.resolved++;
                // console.log(`❌ [HIGH-PROB] Filtered: Resolved (${(market.probability * 100).toFixed(1)}% >= 98%)`);
                return false;
            }

            // Additional safety check for exactly 100% markets
            if (market.probability === 1.0) {
                filteredCount.resolved++;
                // console.log(`❌ [HIGH-PROB] Filtered: Exactly 100% probability`);
                return false;
            }

            // Probability filter: now 60-90% for normal mode, 80-95% for aggressive
            if (market.probability < minProbability || market.probability > maxProbability) {
                filteredCount.probability++;
                // console.log(`❌ [HIGH-PROB] Filtered: Probability (${(market.probability * 100).toFixed(1)}% not in ${(minProbability * 100)}%-${(maxProbability * 100)}%)`);
                return false;
            }

            // Crypto exclusion filter (permanently true)
            if (filters.excludeCrypto && market.isCryptoMarket) {
                filteredCount.crypto++;
                // console.log(`❌ [HIGH-PROB] Filtered: Crypto market`);
                return false;
            }

            // Sports exclusion filter
            if (isSportsMarket(market)) {
                filteredCount.sports++;
                // console.log(`❌ [HIGH-PROB] Filtered: Sports market`);
                return false;
            }

            filteredCount.passed++;
            // console.log(`✅ [HIGH-PROB] Market passed all filters`);
            return true;
        })
        .sort((a, b) => {
            // Sort by expected return descending, then by probability descending
            if (Math.abs(a.expectedReturn - b.expectedReturn) > 0.1) {
                return b.expectedReturn - a.expectedReturn;
            }
            return b.probability - a.probability;
        });

    // Log filtering statistics for debugging
    console.log("🔍 [HIGH-PROB] Market Filtering Results:", {
        total: markets.length,
        filtered: {
            timeFilter: filteredCount.timeFilter,
            inactive: filteredCount.inactive,
            probability: filteredCount.probability,
            crypto: filteredCount.crypto,
            sports: filteredCount.sports,
            resolved: filteredCount.resolved,
            zerodte: filteredCount.zerodte,
        },
        passed: filteredCount.passed,
        finalCount: highProbMarkets.length,
    });

    return highProbMarkets;
}

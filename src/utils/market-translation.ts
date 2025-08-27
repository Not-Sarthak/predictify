import { t } from "../i18n";
import type { SupportedLanguage } from "../i18n";

/**
 * Map of market keywords to translation keys
 */
const MARKET_KEYWORD_MAP: Record<string, string> = {
    // Cryptocurrency names (case-insensitive matching)
    bitcoin: "bitcoin",
    ethereum: "ethereum",
    solana: "solana",
    xrp: "xrp",
    dogecoin: "dogecoin",
    hyperliquid: "hyperliquid",
    orderbook: "orderbook",

    // Market direction words
    up: "up",
    or: "or",
    down: "down",
    what: "what",
    where: "where",
    will: "will",
    with: "with",
    and: "and",
    next: "nextMarket",
    who: "who",
    together: "together",

    // Time periods
    monthly: "monthly",
    hourly: "hourly",
    daily: "daily",
    weekly: "weekly",
    price: "priceMarket",
    hit: "hit",
    in: "in",
    on: "on",
    by: "by",

    // Months
    january: "january",
    february: "february",
    march: "march",
    april: "april",
    may: "may",
    june: "june",
    july: "july",
    august: "august",
    september: "september",
    october: "october",
    november: "november",
    december: "december",

    // Price movements
    above: "above",
    below: "below",
    dip: "dip",
    "all time high": "allTimeHigh",
    "market cap": "marketCap",
    fdv: "fdv",
    before: "before",
    after: "after",

    // Geopolitical terms
    russia: "russia",
    ukraine: "ukraine",
    israel: "israel",
    iran: "iran",
    hamas: "hamas",
    ceasefire: "ceasefire",
    putin: "putin",
    zelenskyy: "zelenskyy",
    trump: "trumpMarket",
    meet: "meet",

    // Economic terms
    fed: "fed",
    meeting: "meeting",
    chair: "chair",
    decision: "decision",
    "jerome powell": "jeromePowelll",
    rate: "rate",
    cut: "cut",
    us: "us",
    recession: "recession",
    inflation: "inflation",
};

/**
 * Translates market titles by replacing known keywords with their translations
 */
export function translateMarketTitle(title: string, language: SupportedLanguage): string {
    if (language === "en") {
        return title; // No translation needed for English
    }

    let translatedTitle = title;

    // Sort keywords by length (longest first) to avoid partial replacements
    const sortedKeywords = Object.keys(MARKET_KEYWORD_MAP).sort((a, b) => b.length - a.length);

    for (const keyword of sortedKeywords) {
        const translationKey = MARKET_KEYWORD_MAP[keyword];
        const translatedWord = t(translationKey as any, language);

        // Create case-insensitive regex for whole word matching
        const regex = new RegExp(`\\b${keyword}\\b`, "gi");
        translatedTitle = translatedTitle.replace(regex, translatedWord);
    }

    return translatedTitle;
}

/**
 * Translates market question by replacing known keywords
 */
export function translateMarketQuestion(question: string, language: SupportedLanguage): string {
    return translateMarketTitle(question, language);
}

/**
 * Helper function to get market display text with translation
 */
export function getTranslatedMarketText(
    market: { question: string; description?: string },
    language: SupportedLanguage
): { question: string; description?: string } {
    return {
        question: translateMarketQuestion(market.question, language),
        description: market.description
            ? translateMarketTitle(market.description, language)
            : undefined,
    };
}

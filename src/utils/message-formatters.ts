import { getUserLanguage } from "../helpers/user-language";
import { t, type SupportedLanguage, type LocaleMessages } from "../i18n";

/**
 * Format market dexport function getOrderStatusText(status: string, language: SupportedLanguage): string {
    const statusMap: Record<string, keyof LocaleMessages> = {
        "pending": "pending",
        "filled": "filled", 
        "cancelled": "cancelled",
        "expired": "expired"
    };
    
    const key = statusMap[status.toLowerCase()];
    return key ? t(key, language) : status;
}anslations
 */
export async function formatMarketMessage(
    userId: number,
    market: any,
    includeActions: boolean = true
): Promise<string> {
    const language = await getUserLanguage(userId);

    const probability = market.probability || market.outcomePrices?.[0] || 0;
    const volume = market.volume || market.volumeUSD || 0;

    let message = `📊 **${market.question || market.title}**\n\n`;

    // Market details
    message += `💰 **${t("probability", language)}**: ${(probability * 100).toFixed(1)}%\n`;
    message += `📈 **${t("volume", language)}**: $${formatNumber(volume)}\n`;

    if (market.liquidity) {
        message += `💧 **${t("liquidity", language)}**: $${formatNumber(market.liquidity)}\n`;
    }

    // Market status
    const status = market.closed ? t("closed", language) : t("active", language);
    message += `📊 **Status**: ${status}\n\n`;

    // Outcome prices if available
    if (market.outcomePrices && market.outcomePrices.length >= 2) {
        message += `**${t("price", language)}:**\n`;
        message += `• ${t("yes", language)}: ${(market.outcomePrices[0] * 100).toFixed(1)}%\n`;
        message += `• ${t("no", language)}: ${(market.outcomePrices[1] * 100).toFixed(1)}%\n\n`;
    }

    return message;
}

/**
 * Format portfolio position with translations
 */
export async function formatPositionMessage(userId: number, position: any): Promise<string> {
    const language = await getUserLanguage(userId);

    const pnl = position.pnl || 0;
    const pnlText = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
    const pnlEmoji = pnl >= 0 ? "🟢" : "🔴";

    let message = `📊 **${position.market?.question || position.title}**\n\n`;
    message += `${pnlEmoji} **${t("pnl", language)}**: ${pnlText}\n`;
    message += `💰 **${t("shares", language)}**: ${position.size || 0}\n`;
    message += `📊 **${t("entry", language)}**: ${(position.avgPrice * 100).toFixed(1)}%\n`;
    message += `💵 **${t("marketValue", language)}**: $${(position.marketValue || 0).toFixed(2)}\n`;

    return message;
}

/**
 * Format order with translations
 */
export async function formatOrderMessage(userId: number, order: any): Promise<string> {
    const language = await getUserLanguage(userId);

    const side = order.side === "BUY" ? t("buy", language) : t("sell", language);
    const outcome = order.outcome === "Yes" ? t("yes", language) : t("no", language);
    const status = getOrderStatusTranslation(order.status, language);

    let message = `📋 **${t("orderType", language)}**: ${side} ${outcome}\n`;
    message += `💰 **${t("amount", language)}**: ${order.size || 0}\n`;
    message += `💲 **${t("price", language)}**: ${(order.price * 100).toFixed(1)}%\n`;
    message += `📊 **${t("orderStatus", language)}**: ${status}\n`;

    if (order.market?.question) {
        message += `🎯 **Market**: ${order.market.question}\n`;
    }

    return message;
}

/**
 * Format high probability market list
 */
export async function formatHighProbMarketsList(
    markets: any[],
    timeFilter: string,
    offset: number,
    totalCount: number,
    language: SupportedLanguage
): Promise<string> {
    if (markets.length === 0) {
        return t("noMarketsFound", language);
    }

    let message = `🎯 **${t("highProbabilityMarkets", language)} (${timeFilter})**\n`;
    message += `📊 ${t("found", language)} ${totalCount} ${t("qualifyingMarkets", language)}\n\n`;

    markets.forEach((market, index) => {
        const marketNum = offset + index + 1;
        const probability = Math.round(market.probability * 100);
        const expectedReturn = market.expectedReturn ? market.expectedReturn.toFixed(1) : "0.0";
        const volume = formatNumber(market.volume || 0);
        const hoursLeft = Math.round(market.hoursUntilExpiry || 0);
        const questionText = market.question
            ? market.question.length > 80
                ? market.question.substring(0, 80) + "..."
                : market.question
            : "Unknown Market";
        const bestOutcome = market.bestOutcome ? market.bestOutcome.toUpperCase() : "YES";

        message += `**${marketNum}.** ${questionText}\n`;
        message += `🎯 **${bestOutcome}** @ ${probability}% • ⏰ ${hoursLeft}h ${t("left", language)}\n`;
        message += `💰 ${t("volume", language)}: $${volume} • 📈 ${t("return", language)}: +${expectedReturn}%\n\n`;
    });

    return message;
}

/**
 * Format subscription categories message
 */
export async function formatSubscriptionCategoriesMessage(
    userId: number,
    categories: string[],
    subscribedCategories: string[]
): Promise<string> {
    const language = await getUserLanguage(userId);

    let message = `🔔 **${t("subscriptionCategories", language)}**\n\n`;

    categories.forEach((category) => {
        const isSubscribed = subscribedCategories.includes(category);
        const status = isSubscribed ? t("subscribed", language) : t("unsubscribed", language);
        const emoji = isSubscribed ? "✅" : "❌";

        const translatedCategory = getCategoryTranslation(category, language);
        message += `${emoji} **${translatedCategory}**: ${status}\n`;
    });

    return message;
}

/**
 * Format price alert message
 */
export async function formatPriceAlertMessage(userId: number, alert: any): Promise<string> {
    const language = await getUserLanguage(userId);

    let message = `🔔 **${t("priceAlert", language)} ${t("alertTriggered", language)}**\n\n`;
    message += `📊 **Market**: ${alert.marketTitle}\n`;
    message += `💲 **${t("price", language)}**: ${(alert.currentPrice * 100).toFixed(1)}%\n`;
    message += `🎯 **${t("priceAlert", language)}**: ${(alert.triggerPrice * 100).toFixed(1)}%\n`;

    return message;
}

/**
 * Helper function to get order status translation
 */
function getOrderStatusTranslation(status: string, language: SupportedLanguage): string {
    const statusMap = {
        PENDING: "pending" as const,
        FILLED: "filled" as const,
        CANCELLED: "cancelled" as const,
        EXPIRED: "expired" as const,
    };

    const key = statusMap[status.toUpperCase() as keyof typeof statusMap];
    return key ? t(key, language) : status;
}

/**
 * Helper function to get category translation
 */
function getCategoryTranslation(category: string, language: SupportedLanguage): string {
    const categoryMap = {
        Politics: "politics" as const,
        Crypto: "crypto" as const,
        Sports: "sports" as const,
        Economics: "economics" as const,
        Entertainment: "entertainment" as const,
        Science: "science" as const,
        Weather: "weather" as const,
        Elections: "elections" as const,
    };

    const key = categoryMap[category as keyof typeof categoryMap];
    return key ? t(key, language) : category;
}

/**
 * Helper function to format numbers
 */
function formatNumber(num: number): string {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + "M";
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + "K";
    } else {
        return num.toFixed(0);
    }
}

// Export the helper functions for external use
export { getOrderStatusTranslation as getOrderStatusText };
export { getCategoryTranslation as getMarketCategoryText };

import type { Symbols } from "../../utils/binance/binance";

import { getMarketOrderBook } from "../../utils/polymarket/get-markets";
import type { UserPositionResponse } from "../../types/polymarket/user-position";
import { getUserDetails } from "../../helpers/get-user-details";
import { decryptApiCredentials, decryptPrivateKey } from "../../utils/crypto";
import { createPaginationKeyboard, createRedeemablePaginationKeyboard } from "../ui/messages";
import type { SupportedLanguage } from "../../i18n";
import { getMessages } from "../../i18n";
import { getMarketCategoryText } from "../../utils/message-formatters";
import { getUserLanguage } from "../../helpers/user-language";
import { t } from "../../i18n";

const SYMBOL_MAP: Record<string, Symbols> = {
    bitcoin: "BTCUSDT",
    ethereum: "ETHUSDT",
    solana: "SOLUSDT",
    xrp: "XRPUSDT",
};

export function formatDate(dateString: string, language: SupportedLanguage): string {
    const date = new Date(dateString);

    // Check if date is valid
    if (isNaN(date.getTime())) {
        return "N/A";
    }

    const day = date.getDate();
    const year = date.getFullYear();
    const getOrdinal = (n: number) => {
        if (n > 3 && n < 21) return "th";
        switch (n % 10) {
            case 1:
                return "st";
            case 2:
                return "nd";
            case 3:
                return "rd";
            default:
                return "th";
        }
    };
    // Try to use i18n month names from messages (keys: january..december)
    try {
        const messages = getMessages(language as any);
        const monthKeys = [
            "january",
            "february",
            "march",
            "april",
            "may",
            "june",
            "july",
            "august",
            "september",
            "october",
            "november",
            "december",
        ];
        const monthIndex = date.getMonth();
        const monthKey = monthKeys[monthIndex];
        const month =
            (messages && (messages as any)[monthKey]) ||
            date.toLocaleString("en-US", { month: "long" });

        return `${month} ${day}${getOrdinal(day)}, ${year}`;
    } catch {
        const month = date.toLocaleString("en-US", { month: "long" }); // e.g., June
        return `${month} ${day}${getOrdinal(day)}, ${year}`;
    }
    // Add ordinal suffix to day (st, nd, rd, th)
}

export function formatActiveSubscriptionsMessage(categories: string[]): string {
    return `Your Subscriptions:\n• ${categories.join("\n• ")}`;
}

export function formatActiveSubscriptionsMessageWithTranslation(
    categories: string[],
    language: SupportedLanguage
): string {
    const translatedCategories = categories.map((cat) => getMarketCategoryText(cat, language));
    const t = getMessages(language);
    return `${t.mySubscriptions}:\n• ${translatedCategories.join("\n• ")}`;
}

export function formatCurrentTradePositionsMessage(
    userPositions: UserPositionResponse[],
    language: SupportedLanguage
) {
    const userPositionsMessages: { message: string; marketId: string }[] = [];

    for (const position of userPositions) {
        const {
            title,
            outcome,
            size,
            avgPrice,
            curPrice,
            currentValue,
            cashPnl,
            percentPnl,
            endDate,
            slug,
        } = position;

        const isProfit = cashPnl > 0;
        const pnlEmoji = isProfit ? "📈" : "📉";
        const outcomeEmoji = outcome === "Yes" ? "🟢" : "🔴";
        const message = `📊 *${title}*
${outcomeEmoji} ${outcome} | ${size} shares @ ${avgPrice.toFixed(4)} → ${curPrice.toFixed(4)}
💼 Value: ${currentValue.toFixed(4)} USDC | ${pnlEmoji} PnL: ${cashPnl.toFixed(2)} (${percentPnl.toFixed(1)}%)

📆 Ends: ${formatDate(endDate, language)}
🔗 [View Market](https://polymarket.com/market/${slug})`;

        userPositionsMessages.push({ message, marketId: position.conditionId });
    }

    return userPositionsMessages;
}

export function formatDollarVolume(n: number): string {
    // Handle undefined, null, or non-numeric values
    if (typeof n !== "number" || isNaN(n) || n == null) {
        return "$0";
    }

    if (n >= 1_000_000_000) return `$${Math.round(n / 1_000_000_000)}B`;
    if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
    if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
    return `$${Math.round(n)}`;
}

export async function formatOrderBook(tokenIds: string[], userId: string) {
    try {
        const [userDetails] = await Promise.all([getUserDetails(Number(userId))]);

        if (!userDetails) {
            return "⚠️ Unable to Fetch Orderbook Data.";
        }

        const language = await getUserLanguage(Number(userId));
        const { private_key, api_credentials } = userDetails;
        const apiCreds = decryptApiCredentials(api_credentials);

        const { yesResponse, noResponse } = await getMarketOrderBook({
            tokenId: tokenIds,
            privateKey: decryptPrivateKey(private_key),
            creds: apiCreds,
        });
        let orderBookDisplay = `📈 **${t("orderbook", language)}**\n`;
        orderBookDisplay += `\`\`\`\n`;
        orderBookDisplay += `Price     Size     Total\n`;
        orderBookDisplay += `---------------------------\n`;

        const yesAsks = yesResponse.asks.slice(-3);
        for (const ask of yesAsks) {
            const price = (parseFloat(ask.price) * 100).toFixed(1);
            const size = parseInt(ask.size);
            const total = parseFloat(ask.price) * size;
            orderBookDisplay += `${price.padEnd(4)} ¢    ${size.toString().padEnd(8)} $${total.toFixed(0)}\n`;
        }

        const yesTotalSize = yesResponse.asks.reduce(
            (sum: number, ask: any) => sum + parseInt(ask.size),
            0
        );
        const noTotalSize = noResponse.asks.reduce(
            (sum: number, ask: any) => sum + parseInt(ask.size),
            0
        );

        const separator = `🔴 ${(yesTotalSize / 1000).toFixed(1)}K • ${(noTotalSize / 1000).toFixed(0)}K 🟢`;
        const dashCount = Math.max(0, (27 - separator.length) / 2);
        orderBookDisplay += `${"-".repeat(Math.floor(dashCount))} ${separator} ${"-".repeat(Math.ceil(dashCount))}\n`;

        const noAsks = noResponse.asks.slice(-3).reverse();
        for (const ask of noAsks) {
            const price = (parseFloat(ask.price) * 100).toFixed(1);
            const size = parseInt(ask.size);
            const total = parseFloat(ask.price) * size;
            orderBookDisplay += `${price.padEnd(4)} ¢    ${size.toString().padEnd(8)} $${total.toFixed(0)}\n`;
        }

        orderBookDisplay += `\`\`\`\n`;

        return orderBookDisplay;
    } catch (error) {
        console.error("Error Fetching Orderbook:", error);
        return "⚠️ Unable to Fetch Orderbook Data.\n\n";
    }
}

export function escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+=|{}.!]/g, "\\$&");
}

export function padButtonText(text: string, maxLength = 40): string {
    const plainText = text.replace(/[*_`~]/g, ""); // Strip markdown for accurate length
    const extraSpaces = maxLength - plainText.length;

    if (extraSpaces <= 0) return text; // No need to pad

    const pad = "\u00A0".repeat(extraSpaces); // Non-breaking space padding
    return text + pad;
}

export async function formatSinglePositionMessage(
    userId: string,
    position: UserPositionResponse,
    index: number,
    total: number
) {
    const language = await getUserLanguage(parseInt(userId));
    const {
        title,
        cashPnl,
        percentPnl,
        conditionId,
        outcome,
        outcomeIndex,
        size,
        avgPrice,
        curPrice,
        initialValue,
        currentValue,
        endDate,
    } = position;

    const isProfit = cashPnl >= 0;
    const pnlEmoji = isProfit ? "📈" : "📉";
    const pnlColor = isProfit ? "🟢" : "🔴";
    const pnlSign = isProfit ? "+" : "";

    const percentPnlFormatted = `${pnlSign}${percentPnl.toFixed(1)}%`;
    const cashPnlFormatted = `${pnlSign}${cashPnl.toFixed(2)}`;
    const avgPriceFormatted = `$${avgPrice.toFixed(4)}`;
    const curPriceFormatted = `$${curPrice.toFixed(4)}`;
    const initialValueFormatted = `$${initialValue.toFixed(2)}`;
    const currentValueFormatted = `$${currentValue.toFixed(2)}`;
    const expiryDate = new Date(endDate);
    const isValidDate = !isNaN(expiryDate.getTime());
    const expiryDateFormatted = isValidDate
        ? expiryDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
          })
        : null;

    const statusLine = `${pnlEmoji} *${isProfit ? t("profit", language) : t("loss", language)}:* ${pnlColor} *${cashPnlFormatted}* (${percentPnlFormatted})`;

    const expiresLine = expiryDateFormatted
        ? `📆 *${t("expires", language)}:* ${expiryDateFormatted}`
        : "";

    const text = `
*${t("yourPolymarketDashboard", language)}*

*${index + 1}/${total} - ${title}*

${pnlColor} *${outcome.toUpperCase()}* • ${size.toFixed(2)} ${t("shares", language)} @ ${avgPriceFormatted}
🎯 *${t("currentPrice", language)}:* ${curPriceFormatted}
${statusLine}
💸 *${t("invested", language)}:* ${initialValueFormatted} → *${t("value", language)}:* ${currentValueFormatted}${expiresLine ? "\n" + expiresLine : ""}
    `.trim();

    const markup = await createPaginationKeyboard(conditionId, index, total, userId, outcomeIndex);

    return { text, markup };
}

export async function formatSingleRedeemablePositionMessage(
    userId: string,
    position: UserPositionResponse,
    index: number,
    total: number
) {
    const language = await getUserLanguage(parseInt(userId));
    const {
        title,
        cashPnl,
        percentPnl,
        conditionId,
        outcome,
        size,
        avgPrice,
        curPrice,
        initialValue,
        currentValue,
        endDate,
    } = position;

    const isProfit = cashPnl >= 0;
    const pnlEmoji = isProfit ? "📈" : "📉";
    const pnlColor = isProfit ? "🟢" : "🔴";
    const pnlSign = isProfit ? "+" : "";

    const percentPnlFormatted = `${pnlSign}${percentPnl.toFixed(1)}%`;
    const cashPnlFormatted = `${pnlSign}${cashPnl.toFixed(2)}`;
    const avgPriceFormatted = `$${avgPrice.toFixed(4)}`;
    const curPriceFormatted = `$${curPrice.toFixed(4)}`;
    const initialValueFormatted = `$${initialValue.toFixed(2)}`;
    const currentValueFormatted = `$${currentValue.toFixed(2)}`;
    const expiryDate = new Date(endDate);
    const isValidDate = !isNaN(expiryDate.getTime());
    const expiryDateFormatted = isValidDate
        ? expiryDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
          })
        : null;

    const statusLine = `${pnlEmoji} *${isProfit ? t("profit", language) : t("loss", language)}:* ${pnlColor} *${cashPnlFormatted}* (${percentPnlFormatted})`;

    const expiredLine = expiryDateFormatted
        ? `📆 *${t("expired", language)}:* ${expiryDateFormatted}`
        : "";

    const text = `
*${t("redeemableDashboard", language)}*

*${index + 1}/${total} - ${title}*

${pnlColor} *${outcome.toUpperCase()}* • ${size.toFixed(2)} ${t("shares", language)} @ ${avgPriceFormatted}
🎯 *${t("currentPrice", language)}:* ${curPriceFormatted}
${statusLine}
💸 *${t("invested", language)}:* ${initialValueFormatted} → *${t("value", language)}:* ${currentValueFormatted}${expiredLine ? "\n" + expiredLine : ""}
    `.trim();

    const markup = await createRedeemablePaginationKeyboard(conditionId, index, total, userId);

    return { text, markup };
}

export function detectSymbolFromSlug(slug: string): Symbols | null {
    const coin = slug.split("-")[0];
    return SYMBOL_MAP[coin];
}

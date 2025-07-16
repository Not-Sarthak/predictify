import { getMarketOrderBook } from "@/utils/polymarket/get-markets";
import type { UserPositionResponse } from "../../types/polymarket/user-position";
import { getUserDetails } from "@/helpers/get-user-details";
import { decryptPrivateKey } from "@/utils/crypto";
import { createPaginationKeyboard } from "@/bot/ui/messages";

export function formatDate(dateString: string): string {
    const date = new Date(dateString);

    const month = date.toLocaleString("en-US", { month: "long" }); // e.g., June
    const day = date.getDate();
    const year = date.getFullYear();

    // Add ordinal suffix to day (st, nd, rd, th)
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

    return `${month} ${day}${getOrdinal(day)}, ${year}`;
}

export function formatActiveSubscriptionsMessage(categories: string[]): string {
    return `Your Subscriptions:\n• ${categories.join("\n• ")}`;
}

export function formatCurrentTradePositionsMessage(userPositions: UserPositionResponse[]) {
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

📆 Ends: ${formatDate(endDate)}
🔗 [View Market](https://polymarket.com/market/${slug})`;

        userPositionsMessages.push({ message, marketId: position.conditionId });
    }

    return userPositionsMessages;
}

export const formatBidLine = ({ price, size }: { price: string; size: string }) =>
    `$${price} × ${Number(size).toLocaleString()}`;

export function formatDollarVolume(n: number): string {
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
}

export async function formatOrderBook(tokenIds: string[], userId: string) {
    try {
        const [userDetails] = await Promise.all([getUserDetails(Number(userId))]);

        if (!userDetails) {
            return "⚠️ Unable to Fetch Orderbook Data.";
        }

        const { private_key, api_credentials } = userDetails;
        const apiCreds = JSON.parse(api_credentials);

        const { yesResponse, noResponse } = await getMarketOrderBook({
            tokenId: tokenIds,
            privateKey: decryptPrivateKey(private_key),
            creds: apiCreds,
        });

        // Format order book in the requested style
        let orderBookDisplay = `📈 **Order Book**\n\n`;
        orderBookDisplay += `\`\`\`\n`;
        orderBookDisplay += `Price     Size     Total\n`;
        orderBookDisplay += `---------------------------\n`;

        // YES asks (top 4)
        const yesAsks = yesResponse.asks.slice(0, 4).reverse();
        for (const ask of yesAsks) {
            const price = (parseFloat(ask.price) * 100).toFixed(1);
            const size = parseInt(ask.size);
            const total = parseFloat(ask.price) * size;
            orderBookDisplay += `${price.padEnd(4)} ¢    ${size.toString().padEnd(8)} $${total.toFixed(0)}\n`;
        }

        // Calculate totals
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

        // NO bids (top 4)
        const noBids = noResponse.bids.slice(0, 4);
        for (const bid of noBids) {
            const price = (parseFloat(bid.price) * 100).toFixed(1);
            const size = parseInt(bid.size);
            const total = parseFloat(bid.price) * size;
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

export function formatSinglePositionMessage(
    position: UserPositionResponse,
    index: number,
    total: number
) {
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
    const expiryDateFormatted = new Date(endDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });

    const text = `
*📊 Your Polymarket Dashboard*

*${index + 1}/${total} - ${title}*

${pnlColor} *${outcome.toUpperCase()}* • ${size.toFixed(2)} shares @ ${avgPriceFormatted}
🎯 *Current Price:* ${curPriceFormatted}
${pnlEmoji} *${isProfit ? "Profit" : "Loss"}:* ${pnlColor} *${cashPnlFormatted}* (${percentPnlFormatted})
💸 *Invested:* ${initialValueFormatted} → *Value:* ${currentValueFormatted}
📆 *Expires:* ${expiryDateFormatted}
    `.trim();

    const markup = createPaginationKeyboard(conditionId, index, total);

    return { text, markup };
}

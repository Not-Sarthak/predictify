import { getMarketOrderBook } from "@/utils/polymarket/get-markets";
import type { UserPositionResponse } from "../../types/polymarket/user-position";
import { getUserDetails } from "@/helpers/get-user-details";

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
    return `You're Subscribed To:\n• ${categories.join("\n• ")}`;
}

export function formatCurrentTradePositionsMessageForViewing(
    userPositions: UserPositionResponse[]
) {
    let total = 0;

    const messages = userPositions.map((position, index) => {
        const { title, cashPnl } = position;
        total += cashPnl;

        const isProfit = cashPnl > 0;
        const pnlEmoji = isProfit ? "📈" : "📉";
        const pnlLabel = isProfit ? "Profit" : "Loss";
        const pnlColor = isProfit ? "🟢" : "🔴";

        return `*${index + 1})* ${title}\n${pnlEmoji} ${pnlLabel}: ${pnlColor} *${cashPnl.toFixed(2)}* USDC`;
    });

    const netEmoji = total >= 0 ? "✅" : "⚠️";
    const netPnl = `*Total PnL:* ${netEmoji} ${total >= 0 ? "🟢" : "🔴"} *${total.toFixed(2)}* USDC`;

    return [...messages, netPnl];
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
            privateKey: private_key,
            creds: apiCreds,
        });

        const formatOrderBookLine = ({ price, size }: { price: string; size: string }) => {
            const usdcValue = parseFloat(price) * parseFloat(size);
            return `$${usdcValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        };

        const yesBids = yesResponse.bids.slice(0, 5).map(formatOrderBookLine);
        const noBids = noResponse.bids.slice(0, 5).map(formatOrderBookLine);

        let orderBookDisplay = `📈 **Order Book**\n`;

        if (yesBids.length > 0) {
            orderBookDisplay += `**🟢 YES** (${yesBids.length} orders):\n${yesBids.join(" • ")}\n\n`;
        } else {
            orderBookDisplay += `**🟢 YES**: No Liquidity Available\n\n`;
        }

        if (noBids.length > 0) {
            orderBookDisplay += `**🔴 NO** (${noBids.length} orders):\n${noBids.join(" • ")}\n\n`;
        } else {
            orderBookDisplay += `**🔴 NO**: No Liquidity Available\n\n`;
        }

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

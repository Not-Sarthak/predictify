import type { UserPositionResponse } from "../../shared/types/polymarket/user-position";

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

export function formatCurrentTradePositionsMessage(userPositions: UserPositionResponse[]) {
    const userPositionsMessages: string[] = [];

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

        userPositionsMessages.push(message);
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

export function escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+=|{}.!]/g, "\\$&");
}

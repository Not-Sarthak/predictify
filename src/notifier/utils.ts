export function handleCronError(err: unknown, context = "Unknown") {
    const timestamp = new Date().toISOString();
    const error = err instanceof Error ? err : new Error(JSON.stringify(err));
    console.error(
        `\n❌ [${timestamp}] CRON ERROR in ${context}:\n${error.message}\n${error.stack}\n`
    );
}

export function normalizeTitle(title: string): string {
    return (
        title
            // Remove common time formats like '5PM ET', '12:30 AM PST', etc.
            .replace(/\b\d{1,2}(:\d{2})?\s?(AM|PM)\s?(ET|EST|PST|CST|UTC|GMT)?\b/gi, "")
            // Remove full weekday or month date phrases like 'on July 18', 'August 3rd', 'Friday', etc.
            .replace(/\b(on\s)?(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi, "")
            .replace(
                /\b(on\s)?(January|February|March|April|May|June|July|August|September|October|November|December)\s\d{1,2}(st|nd|rd|th)?\b/gi,
                ""
            )
            // Remove standalone months/days/years/numerical dates
            .replace(
                /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/gi,
                ""
            )
            .replace(/\b\d{1,2}(st|nd|rd|th)?\b/g, "") // remove "1st", "2nd", etc.
            .replace(/\b20\d{2}\b/g, "") // remove years like 2024, 2025
            // Remove punctuation, extra spacing
            .replace(/[\?\-:,]/g, "")
            .replace(/\s+/g, " ") // collapse spaces
            .trim()
    );
}

export function generateOrderFilledMessage(trade: any, question: string): string {
    const matched = trade.maker_orders[0];
    const isBuy = trade.side === "BUY";
    const side = isBuy ? "Buy" : "Sell";
    const amount = parseFloat(trade.size).toFixed(4);
    const outcome = isBuy ? trade.outcome : matched.outcome;
    const price = parseFloat(trade.price).toFixed(2);

    const polygonScanMsg = `<b>Tx:</b> <a href="https://polygonscan.com/tx/${trade.transaction_hash}">View on Polygonscan</a>`;

    return (
        `🎯 <b>Your Limit Order Was Filled!</b>\n\n` +
        `<b>Market:</b> ${question}\n` +
        `<b>Side:</b> ${side}\n` +
        `<b>Outcome:</b> ${outcome}\n` +
        `<b>Shares:</b> ${amount}\n` +
        `<b>Price:</b> ${price}\n` +
        polygonScanMsg
    );
}

export async function getMarketQuestion(marketId: string): Promise<string | null> {
    try {
        const res = await fetch(
            `https://gamma-api.polymarket.com/markets?condition_ids=${marketId}`
        );
        const market = await res.json();

        if (!market) return null;

        return market[0].question;
    } catch (error) {
        console.error("❌ Error fetching Market Question: ", error);
        return null;
    }
}

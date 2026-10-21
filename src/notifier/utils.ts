import type { UserFill } from "./ws/fills";

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

export function generateOrderFilledMessage(
    fill: UserFill,
    question: string,
    transactionHash?: string
): string {
    const side = fill.side === "BUY" ? "Buy" : "Sell";
    const amount = fill.shares.toFixed(4);
    const outcome = fill.outcome;
    const price = fill.price.toFixed(2);

    const polygonScanMsg = transactionHash
        ? `<b>Tx:</b> <a href="https://polygonscan.com/tx/${transactionHash}">View on Polygonscan</a>`
        : "";

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

export function generatePriceAlertMessage(params: {
    type: "take_profit" | "stop_loss" | "alert";
    question: string;
    thresholdPrice: number;
    currentPrice: number;
    outcomeSide?: string;
}): string {
    const { type, question, thresholdPrice, currentPrice, outcomeSide } = params;

    const typeLabel = {
        take_profit: "✅ <b>Take Profit Triggered!</b>",
        stop_loss: "🛑 <b>Stop Loss Triggered!</b>",
        alert: "📈 <b>Price Alert</b>",
    }[type];

    const outcomeLine = outcomeSide ? `<b>Outcome:</b> ${outcomeSide.toUpperCase()}\n` : "";

    const priceDiff = currentPrice - thresholdPrice;
    const movementEmoji = priceDiff >= 0 ? "📈" : "📉";
    const priceMovement = `${movementEmoji} <b>Price Movement:</b> ${priceDiff >= 0 ? "+" : "-"}$${Math.abs(priceDiff).toFixed(4)}\n`;

    return (
        `${typeLabel}\n\n` +
        `<b>Market:</b> ${question}\n` +
        outcomeLine +
        `<b>Trigger Price:</b> $${thresholdPrice.toFixed(4)}\n` +
        `<b>Current Price:</b> $${currentPrice.toFixed(4)}\n` +
        priceMovement
    );
}

export function generateTPorSLMessage(params: {
    type: "take_profit" | "stop_loss";
    question: string;
    thresholdPrice: number;
    currentPrice: number;
    outcomeSide: string;
    shares: number;
}): string {
    const { type, thresholdPrice, currentPrice, question, outcomeSide, shares } = params;

    const isTakeProfit = type === "take_profit";
    const typeTitle = isTakeProfit
        ? "✅ <b>Take Profit Executed</b>"
        : "🛑 <b>Stop Loss Executed</b>";

    const actionLine = isTakeProfit
        ? `Target reached. Your position was sold to lock in gains.`
        : `Threshold breached. Position exited to minimize further loss.`;

    return (
        `${typeTitle}\n\n` +
        `<b>Market:</b> ${question}\n` +
        `<b>Outcome:</b> ${outcomeSide.toUpperCase()}\n` +
        `<b>Executed Price:</b> $${currentPrice.toFixed(4)}\n` +
        `<b>Trigger Price:</b> $${thresholdPrice.toFixed(4)}\n` +
        `<b>Shares Sold:</b> ${shares.toFixed(4)}\n\n` +
        `${actionLine}`
    );
}

export function generateTPorSLFailedMessage(params: {
    type: "take_profit" | "stop_loss";
    question: string;
    thresholdPrice: number;
    currentPrice: number;
    outcomeSide: string;
}): string {
    const { type, thresholdPrice, currentPrice, question, outcomeSide } = params;

    const typeLabel = type === "take_profit" ? "Take Profit" : "Stop Loss";

    return (
        `⚠️ <b>${typeLabel} Triggered, but the Sell Failed</b>\n\n` +
        `<b>Market:</b> ${question}\n` +
        `<b>Outcome:</b> ${outcomeSide.toUpperCase()}\n` +
        `<b>Trigger Price:</b> $${thresholdPrice.toFixed(4)}\n` +
        `<b>Best Bid:</b> $${currentPrice.toFixed(4)}\n\n` +
        `Your shares were not sold. Please close the position manually.`
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

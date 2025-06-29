import { bot } from "@/bot";
import { generateNotificationMessage } from "@/bot/ui/messages";
import type { MarketData } from "@/shared/types/polymarket/market-data";

export async function sendNotificationToUser(userId: string, market: MarketData, category: string) {
    const { message, keyboard } = generateNotificationMessage(market, category);

    try {
        await bot.telegram.sendPhoto(userId, market.image, {
            caption: message,
            parse_mode: "HTML",
            reply_markup: keyboard,
        });
    } catch (error) {
        console.error(`Failed to Send Photo to ${userId}:`, error);
    }
}

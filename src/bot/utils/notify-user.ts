import type { EventData } from "@/types/polymarket/market-data";

import { bot } from "@/bot";
import { generateNotificationMessage } from "@/bot/ui/messages";

export async function sendNotificationToUser(userId: string, event: EventData, category: string) {
    const { message, keyboard } = generateNotificationMessage(event, category);

    try {
        await bot.telegram.sendPhoto(userId, event.image, {
            caption: message,
            parse_mode: "HTML",
            reply_markup: keyboard,
        });
    } catch (error) {
        console.error(`Failed to Send Photo to ${userId}:`, error);
    }
}

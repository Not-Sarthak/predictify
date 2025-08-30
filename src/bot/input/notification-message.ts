import type { Context } from "telegraf";
import { redisClient } from "../../lib/redis";
import { clearUserInputState } from "./state";
import { Markup } from "telegraf";

export async function handleNotificationMessage(ctx: Context) {
    const message = ctx.text;
    if (!message) return;

    const userId = ctx.from?.id;
    if (!userId) return;

    await redisClient.set(`notification:message:${userId}`, message, { EX: 300 });
    await clearUserInputState(userId.toString());

    await ctx.reply(`📋 *Notification Preview:*\n\n${message}\n\nSend this to all users?`, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
            [Markup.button.callback("✅ Send", `confirm_notification:${userId}`)],
            [Markup.button.callback("❌ Cancel", `cancel_notification:${userId}`)],
        ]),
    });
}

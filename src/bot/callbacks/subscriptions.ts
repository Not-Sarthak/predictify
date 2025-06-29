import {
    CLOSE_BUTTON,
    SUBSCRIBE_BUTTONS,
    SUBSCRIPTIONS_MENU_BUTTONS,
    UNSUBSCRIBE_BUTTONS,
} from "@/bot/ui/buttons";
import { formatActiveSubscriptionsMessage, getUserIdFromCtx } from "@/bot/utils";
import { redisClient } from "@/lib/redis";
import { Markup, type Context } from "telegraf";

export async function handleSubscriptionsMenu(ctx: Context) {
    return ctx.editMessageReplyMarkup(
        Markup.inlineKeyboard(SUBSCRIPTIONS_MENU_BUTTONS).reply_markup
    );
}

export async function handleSubscriptionMenuCallbacks(ctx: Context, action: string) {
    switch (action) {
        case "subscribe":
            return ctx
                .reply(
                    "Choose a Category to Subscribe to",
                    Markup.inlineKeyboard(SUBSCRIBE_BUTTONS)
                )
                .then(() => ctx.answerCbQuery());
        case "unsubscribe":
            return ctx
                .reply(
                    "Choose a Category to Unsubscribe from",
                    Markup.inlineKeyboard(UNSUBSCRIBE_BUTTONS)
                )
                .then(() => ctx.answerCbQuery());
        case "view":
            return handleDisplayActiveSubscriptions(ctx);
        default:
            return ctx.answerCbQuery();
    }
}

export async function handleDisplayActiveSubscriptions(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);

    const categories: string[] = [];
    const keys = await redisClient.keys("subscriptions:*");

    for (const key of keys) {
        const isMember = await redisClient.sIsMember(key, userId.toString());
        if (isMember) {
            categories.push(key.split(":")[1]);
        }
    }

    if (categories.length === 0) {
        return ctx.reply("You have no Active Subscriptions.").then(() => ctx.answerCbQuery());
    }

    return ctx
        .reply(formatActiveSubscriptionsMessage(categories), {
            reply_markup: Markup.inlineKeyboard([CLOSE_BUTTON]).reply_markup,
        })
        .then(() => ctx.answerCbQuery());
}

export async function handleSubscriptionManagement(
    ctx: Context,
    isSubscribe: string,
    category: string
) {
    const userId = getUserIdFromCtx(ctx).toString();

    if (isSubscribe === "yes") {
        await redisClient.sAdd(`subscriptions:${category}`, userId);
        await ctx.answerCbQuery(`✅ Subscribed to ${category}`);
        return ctx.reply(`📬 You'll Now Receive Alerts for: ${category}`);
    }

    await redisClient.sRem(`subscriptions:${category}`, userId);
    await ctx.answerCbQuery(`❌ Unsubscribed from ${category}`);
    return ctx.reply(`🗑️ Alerts Removed For: ${category}`);
}

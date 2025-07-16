import { setUserInputState } from "@/bot/input/state";
import {
    CLOSE_BUTTON,
    generateSubscriptionButtons,
    SUBSCRIPTIONS_MENU_BUTTONS,
} from "@/bot/ui/buttons";
import { formatActiveSubscriptionsMessage, getUserIdFromCtx } from "@/bot/utils";
import { redisClient } from "@/lib/redis";
import { CATEGORY_LIST } from "@/shared/constants";
import { Markup, type Context } from "telegraf";

export async function handleSubscriptionsMenu(ctx: Context) {
    return ctx.editMessageReplyMarkup(
        Markup.inlineKeyboard(SUBSCRIPTIONS_MENU_BUTTONS).reply_markup
    );
}

export async function handleSubscriptionMenuCallbacks(ctx: Context, action: string) {
    switch (action) {
        case "subscribe":
            return ctx.reply(
                "Choose a Category to Subscribe to",
                Markup.inlineKeyboard(generateSubscriptionButtons(CATEGORY_LIST, "subscribe"))
            );
        case "unsubscribe":
            return handleUnsubscribe(ctx);
        case "view":
            return handleDisplayActiveSubscriptions(ctx);
        case "custom":
            return handleCustomCategory(ctx);
    }
}

export async function handleDisplayActiveSubscriptions(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);
    const categories = await redisClient.sMembers(`user:subs:${userId}`);

    if (categories.length === 0) {
        return ctx.reply("⚠️ You have no Active Subscriptions.");
    }

    return ctx.reply(formatActiveSubscriptionsMessage(categories), {
        reply_markup: Markup.inlineKeyboard([CLOSE_BUTTON]).reply_markup,
    });
}

export async function handleSubscriptionManagement(
    ctx: Context,
    isSubscribe: string,
    category: string
) {
    const userId = getUserIdFromCtx(ctx).toString();

    if (isSubscribe === "yes") {
        await redisClient
            .multi()
            .sAdd(`user:subs:${userId}`, category)
            .hIncrBy("categories", category, 1)
            .exec();

        return ctx.editMessageText(`📬 You'll Now Receive Alerts for: ${category}`);
    }

    await redisClient.sRem(`user:subs:${userId}`, category);

    const newCount = await redisClient.hIncrBy("categories", category, -1);
    if (newCount <= 0) {
        await redisClient.hDel("categories", category);
    }

    return ctx.editMessageText(`🗑️ Alerts Removed For: ${category}`);
}

export async function handleUnsubscribe(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);
    const categories = await redisClient.sMembers(`user:subs:${userId}`);

    if (categories.length === 0) {
        return ctx.reply("⚠️ You have no Active Subscriptions.");
    }

    const buttons = generateSubscriptionButtons(categories, "unsubscribe");

    return ctx.reply("Choose a Category to Unsubscribe from", Markup.inlineKeyboard(buttons));
}

export async function handleCustomCategoryInput(ctx: Context, textMessage: string) {
    const userId = getUserIdFromCtx(ctx).toString();

    await redisClient
        .multi()
        .sAdd(`user:subs:${userId}`, textMessage)
        .hIncrBy("categories", textMessage, 1)
        .exec();

    return ctx.reply(`📬 You'll Now Receive Alerts for: ${textMessage}`);
}

async function handleCustomCategory(ctx: Context) {
    const userId = getUserIdFromCtx(ctx).toString();

    await setUserInputState(userId, "custom_category");
    return ctx.reply("✍️ Enter a Category name: ");
}

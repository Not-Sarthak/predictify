import { setUserInputState } from "../input/state";
import {
    CLOSE_BUTTON,
    generateSubscriptionButtons,
    SUBSCRIPTIONS_MENU_BUTTONS,
} from "../ui/buttons";
import { formatActiveSubscriptionsMessage, getUserIdFromCtx } from "../utils";
import { redisClient } from "../../lib/redis";
import { getMarketQuestion } from "../../notifier/utils";
import { CATEGORY_LIST } from "../../shared/constants";
import { shortHashKey } from "../../utils/crypto";
import { Markup, type Context } from "telegraf";
import type { InlineKeyboardButton } from "telegraf/types";

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

export async function handleShowCurrentPriceAlerts(ctx: Context, pageIndex = 0, isEdit = false) {
    const userId = getUserIdFromCtx(ctx);
    const key = `user:price_alerts:${userId}`;
    const alertsRaw = await redisClient.hGetAll(key);

    const alertEntries = Object.entries(alertsRaw);
    const total = alertEntries.length;

    if (total === 0) {
        return isEdit
            ? ctx.editMessageText("📭 No active price alerts found.")
            : ctx.reply("📭 No active price alerts found.");
    }

    if (pageIndex >= total) pageIndex = total - 1;
    if (pageIndex < 0) pageIndex = 0;

    const [fieldKey, configStr] = alertEntries[pageIndex];
    const config = JSON.parse(configStr);

    const marketTitle = await getMarketQuestion(config.marketId);
    const shortKey = shortHashKey(fieldKey);

    // Store reverse mapping for edit/delete handlers
    await redisClient.hSet(`user:price_alert_keys:${userId}`, shortKey, fieldKey);

    const message = `🔔 <b>Price Alert (${pageIndex + 1}/${total})</b>

<b>Market:</b> ${marketTitle}
<b>Outcome:</b> ${config.outcome.toUpperCase()}
<b>Type:</b> ${config.type.replace("_", " ").toUpperCase()}
<b>Trigger Price:</b> ${config.price}

You will be notified when this condition is met.`;

    const buttons: InlineKeyboardButton[][] = [];
    const navButtons: InlineKeyboardButton[] = [];

    if (pageIndex > 0) {
        navButtons.push({ text: "⬅ Prev", callback_data: `alert_nav:${pageIndex - 1}` });
    }
    if (pageIndex < total - 1) {
        navButtons.push({ text: "Next ➡", callback_data: `alert_nav:${pageIndex + 1}` });
    }

    buttons.push([
        { text: "✏️ Edit Alert", callback_data: `alert_edit:${shortKey}` },
        { text: "🗑️ Delete Alert", callback_data: `alert_delete:${shortKey}` },
    ]);

    buttons.push(navButtons);
    buttons.push([CLOSE_BUTTON]);

    const sendOrEdit = isEdit ? ctx.editMessageText.bind(ctx) : ctx.reply.bind(ctx);
    await sendOrEdit(message, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: buttons },
    });
}

async function handleCustomCategory(ctx: Context) {
    const userId = getUserIdFromCtx(ctx).toString();

    await setUserInputState(userId, "custom_category");
    return ctx.reply("✍️ Enter a Category name: ");
}

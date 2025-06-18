import { Context, Markup } from "telegraf";
import { redisClient } from "./redis";
import {
  SUBSCRIBE_BUTTONS,
  UNSUBSCRIBE_BUTTONS,
  SUBSCRIBE_MESSAGE,
  UNSUBSCRIBE_MESSAGE,
  NO_SUBSCRIPTIONS_MESSAGE,
  ACTIVE_SUBSCRIPTIONS_MESSAGE,
} from "../constants/telegram";

/* Commands */

// Subscribe: Allows the User to Subscribe to a Category
export async function handleSubscribeCommand(ctx: Context) {
  return ctx.reply(SUBSCRIBE_MESSAGE, Markup.inlineKeyboard(SUBSCRIBE_BUTTONS));
}

// Unsubscribe: Allows the User to Unsubscribe from a Category
export async function handleUnsubscribeCommand(ctx: Context) {
  return ctx.reply(
    UNSUBSCRIBE_MESSAGE,
    Markup.inlineKeyboard(UNSUBSCRIBE_BUTTONS)
  );
}

// MySubscriptions: Allows the User to View their Active Subscriptions
export async function handleMySubscriptionsCommand(ctx: Context) {
  const userId = ctx.chat?.id.toString();
  if (!userId) return;

  const categories: string[] = [];
  const keys = await redisClient.keys("subscriptions:*");

  for (const key of keys) {
    const isMember = await redisClient.sIsMember(key, userId);
    if (isMember) {
      categories.push(key.split(":")[1]);
    }
  }

  if (categories.length === 0) {
    return ctx.reply(NO_SUBSCRIPTIONS_MESSAGE);
  }

  return ctx.reply(ACTIVE_SUBSCRIPTIONS_MESSAGE(categories));
}

export async function handleCallbackQuery(ctx: Context) {
  const data = (ctx.callbackQuery as any).data as string;
  const userId = ctx.from!.id.toString();

  if (data.startsWith("subscribe_")) {
    const category = data.split("_")[1];
    await redisClient.sAdd(`subscriptions:${category}`, userId);
    await ctx.answerCbQuery(`✅ Subscribed to ${category}`);
    return ctx.reply(`📬 You'll now receive alerts for: ${category}`);
  }

  if (data.startsWith("unsubscribe_")) {
    const category = data.split("_")[1];
    await redisClient.sRem(`subscriptions:${category}`, userId);
    await ctx.answerCbQuery(`❌ Unsubscribed from ${category}`);
    return ctx.reply(`🗑️ Alerts removed for: ${category}`);
  }

  if (data.startsWith("buy_yes:")) {
    const marketId = data.split(":")[1];
    // Call placeSingleOrder Function here w/ Yes
    await ctx.answerCbQuery("✅ Buy Yes clicked");
    return ctx.reply(`🟢 You chose to Buy Yes on market: ${marketId}`);
  }

  if (data.startsWith("buy_no:")) {
    const marketId = data.split(":")[1];
    // Call placeSingleOrder Function here w/ No
    await ctx.answerCbQuery("❌ Buy No clicked");
    return ctx.reply(`🔴 You chose to Buy No on market: ${marketId}`);
  }

  return ctx.answerCbQuery();
}

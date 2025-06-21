import { Context } from "telegraf";
import { redisClient } from "../../config/redis";
import {
  handleSubscriptionsMenu,
  handleTradeMenu,
  handleAutoTradeMenu,
  handleSettingsMenu,
  handleSubscribeMenu,
  handleUnsubscribeMenu,
  handleWalletSettingsMenu,
} from "./menu-handlers";
import { formatActiveSubscriptionsMessage } from "./message-formatters";
import { NO_SUBSCRIPTIONS_MESSAGE } from "../../constants/telegram";

export async function handleStartCallbacks(ctx: Context, action: string) {
  await ctx.editMessageReplyMarkup(undefined).catch(() => {});

  switch (action) {
    case "subscriptions":
      return handleSubscriptionsMenu(ctx);
    case "trade":
      return handleTradeMenu(ctx);
    case "autotrade":
      return handleAutoTradeMenu(ctx);
    case "settings":
      return handleSettingsMenu(ctx);
    default:
      return ctx.answerCbQuery();
  }
}

export async function handleSubscriptionMenuCallbacks(
  ctx: Context,
  action: string
) {
  switch (action) {
    case "subscribe":
      return handleSubscribeMenu(ctx);
    case "unsubscribe":
      return handleUnsubscribeMenu(ctx);
    case "manage":
      return handleMySubscriptionsDisplay(ctx);
    default:
      return ctx.answerCbQuery();
  }
}

export async function handleMySubscriptionsDisplay(ctx: Context) {
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

  return ctx.reply(formatActiveSubscriptionsMessage(categories));
}

export async function handleSubscriptionCallbacks(
  ctx: Context,
  category: string
) {
  const userId = ctx.from!.id.toString();
  await redisClient.sAdd(`subscriptions:${category}`, userId);
  await ctx.answerCbQuery(`✅ Subscribed to ${category}`);
  return ctx.reply(`📬 You'll Now Receive Alerts for: ${category}`);
}

export async function handleUnsubscriptionCallbacks(
  ctx: Context,
  category: string
) {
  const userId = ctx.from!.id.toString();
  await redisClient.sRem(`subscriptions:${category}`, userId);
  await ctx.answerCbQuery(`❌ Unsubscribed from ${category}`);
  return ctx.reply(`🗑️ Alerts Removed For: ${category}`);
}

export async function handleTradeCallbacks(
  ctx: Context,
  action: string,
  marketId: string
) {
  if (action === "yes") {
    // Call placeSingleOrder Function here w/ Yes
    await ctx.answerCbQuery("✅ Buy Yes Clicked");
    return ctx.reply(`🟢 You Chose to Buy Yes on Market: ${marketId}`);
  } else if (action === "no") {
    // Call placeSingleOrder Function here w/ No
    await ctx.answerCbQuery("❌ Buy No Clicked");
    return ctx.reply(`🔴 You Chose to Buy No on Market: ${marketId}`);
  }

  return ctx.answerCbQuery();
}

export async function handleWalletSettingsMenuCallbacks(ctx: Context) {
  return handleWalletSettingsMenu(ctx);
}

export async function handleCloseMenu(ctx: Context) {
  await ctx.answerCbQuery("Menu closed");
  return ctx.editMessageReplyMarkup(undefined).catch(() => {});
}

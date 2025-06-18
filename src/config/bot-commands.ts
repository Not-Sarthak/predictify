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

export async function handleStartCommand(ctx: Context) {
  const address = "0xasdf";

  const inlineKeyboard = Markup.inlineKeyboard([
    [
      {
        text: "🔔 Subscriptions",
        callback_data: `start_subscriptions`,
      },
      {
        text: "🔥 Trade",
        callback_data: `start_trade`,
      },
    ],
    [
      {
        text: "🤖 AutoTrade",
        callback_data: `start_autotrade`,
      },
      {
        text: "⚙️ Settings",
        callback_data: `start_settings`,
      },
    ],
  ]).reply_markup;

  const message = `
Welcome back to Polymarket Bot!

Your wallet: <code>${address}</code>
Balance: 0 USDC

How to use:
1. 📢 Set Alerts for Market Categories
2. ⚡ Open a Position in Just 2 Clicks
3. 🤖 AutoTrade (Copytrading)
`;

  return ctx.reply(message, {
    parse_mode: "HTML",
    reply_markup: inlineKeyboard,
  });
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

  if (data.startsWith("start_")) {
    const action = data.split("_")[1];

    await ctx.editMessageReplyMarkup(undefined).catch(() => {});

    if (action === "subscriptions") {
      return ctx.reply(
        SUBSCRIBE_MESSAGE,
        Markup.inlineKeyboard(SUBSCRIBE_BUTTONS)
      );
    } else if (action === "trade") {
      return ctx.reply(
        "Trade Menu:",
        Markup.inlineKeyboard([
          [
            Markup.button.callback("⚡ Open Position", "Open a New Position"),
            Markup.button.callback(
              "📈 View Positions",
              "View your Open Positions"
            ),
          ],
          [Markup.button.callback("🔎 Top Markets", "View Top Markets")],
        ])
      );
    } else if (action === "autotrade") {
      return ctx.reply(
        "AutoTrade Menu:",
        Markup.inlineKeyboard([
          [
            Markup.button.callback("➕ Add Wallet", "Adds a New Wallet"),
            Markup.button.callback("🗑️ Delete Wallet", "Delete your wallet"),
          ],
          [
            Markup.button.callback(
              "✅ Enable CopyTrade",
              "Turn on CopyTrading"
            ),
          ],
          [Markup.button.callback("❌ Close", "Close Menu")],
        ])
      );
    } else if (action === "settings") {
      return ctx.reply(
        "Settings Menu:",
        Markup.inlineKeyboard([
          [Markup.button.callback("💼 Wallet Settings", "Manage your Wallet")],
          [Markup.button.callback("❌ Close", "Close Menu")],
        ])
      );
    }
  }

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

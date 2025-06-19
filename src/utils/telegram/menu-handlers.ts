import { Context, Markup } from "telegraf";

export async function handleSubscriptionsMenu(ctx: Context) {
  const subscriptionButtons = [
    [
      Markup.button.callback("🔔 Subscribe", "subscription_subscribe"),
      Markup.button.callback("🔕 Unsubscribe", "subscription_unsubscribe"),
    ],
    [
      Markup.button.callback("📋 My Subscriptions", "subscription_manage"),
    ],
    [
      Markup.button.callback("❌ Close", "close_menu"),
    ],
  ];

  return ctx.reply("📢 Subscription Management:", Markup.inlineKeyboard(subscriptionButtons));
}

export async function handleSubscribeMenu(ctx: Context) {
  const { SUBSCRIBE_MESSAGE, SUBSCRIBE_BUTTONS } = await import("../../constants/telegram");
  return ctx.reply(SUBSCRIBE_MESSAGE, Markup.inlineKeyboard(SUBSCRIBE_BUTTONS));
}

export async function handleUnsubscribeMenu(ctx: Context) {
  const { UNSUBSCRIBE_MESSAGE, UNSUBSCRIBE_BUTTONS } = await import("../../constants/telegram");
  return ctx.reply(UNSUBSCRIBE_MESSAGE, Markup.inlineKeyboard(UNSUBSCRIBE_BUTTONS));
}

export async function handleTradeMenu(ctx: Context) {
  const tradeButtons = [
    [
      Markup.button.callback("⚡ Open Position", "Open a New Position"),
      Markup.button.callback("📈 View Positions", "View your Open Positions"),
    ],
    [Markup.button.callback("🔎 Top Markets", "View Top Markets")],
  ];

  return ctx.reply("Trade Menu:", Markup.inlineKeyboard(tradeButtons));
}

export async function handleAutoTradeMenu(ctx: Context) {
  const autoTradeButtons = [
    [
      Markup.button.callback("➕ Add Wallet", "Adds a New Wallet"),
      Markup.button.callback("🗑️ Delete Wallet", "Delete your wallet"),
    ],
    [
      Markup.button.callback("✅ Enable CopyTrade", "Turn on CopyTrading"),
    ],
    [Markup.button.callback("❌ Close", "Close Menu")],
  ];

  return ctx.reply("AutoTrade Menu:", Markup.inlineKeyboard(autoTradeButtons));
}

export async function handleSettingsMenu(ctx: Context) {
  const settingsButtons = [
    [Markup.button.callback("💼 Wallet Settings", "Manage your Wallet")],
    [Markup.button.callback("❌ Close", "Close Menu")],
  ];

  return ctx.reply("Settings Menu:", Markup.inlineKeyboard(settingsButtons));
} 
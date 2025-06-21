import { Context, Markup } from "telegraf";
import {
  getUserBalance,
  getUserTotalBalance,
} from "../../helpers/get-user-balance";
import { supabase } from "../../config/supabase";

export async function handleSubscriptionsMenu(ctx: Context) {
  const subscriptionButtons = [
    [
      Markup.button.callback("🔔 Subscribe", "subscription_subscribe"),
      Markup.button.callback("🔕 Unsubscribe", "subscription_unsubscribe"),
    ],
    [Markup.button.callback("📋 My Subscriptions", "subscription_manage")],
    [Markup.button.callback("❌ Close", "close_menu")],
  ];

  return ctx.reply(
    "📢 Subscription Management:",
    Markup.inlineKeyboard(subscriptionButtons)
  );
}

export async function handleSubscribeMenu(ctx: Context) {
  const { SUBSCRIBE_MESSAGE, SUBSCRIBE_BUTTONS } = await import(
    "../../constants/telegram"
  );
  return ctx.reply(SUBSCRIBE_MESSAGE, Markup.inlineKeyboard(SUBSCRIBE_BUTTONS));
}

export async function handleUnsubscribeMenu(ctx: Context) {
  const { UNSUBSCRIBE_MESSAGE, UNSUBSCRIBE_BUTTONS } = await import(
    "../../constants/telegram"
  );
  return ctx.reply(
    UNSUBSCRIBE_MESSAGE,
    Markup.inlineKeyboard(UNSUBSCRIBE_BUTTONS)
  );
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
    [Markup.button.callback("✅ Enable CopyTrade", "Turn on CopyTrading")],
    [Markup.button.callback("❌ Close", "close_menu")],
  ];

  return ctx.reply("AutoTrade Menu:", Markup.inlineKeyboard(autoTradeButtons));
}

export async function handleSettingsMenu(ctx: Context) {
  const settingsButtons = [
    [Markup.button.callback("💼 Wallet Settings", "wallet_settings_menu")],
    [Markup.button.callback("❌ Close", "close_menu")],
  ];

  return ctx.reply("Settings Menu:", Markup.inlineKeyboard(settingsButtons));
}

export async function handleWalletSettingsMenu(ctx: Context) {
  try {
    const userId = ctx.from?.id;

    const { data: user, error } = await supabase
      .from("Users")
      .select("wallet_address")
      .eq("id", userId)
      .single();

    if (error || !user) {
      console.error("Failed to fetch user wallet:", error);
      return ctx.reply("❌ Unable to retrieve wallet info.");
    }

    const walletAddress = user.wallet_address;

    const usdcBalance = await getUserBalance(walletAddress);
    const totalBalance = await getUserTotalBalance(walletAddress);

    const message =
      `🔑 <b>Your wallet address:</b>\n<code>${walletAddress}</code>\n\n` +
      `💵 <b>USDC Balance:</b> $${usdcBalance}\n` +
      `💰 <b>Total Balance (All tokens):</b> $${totalBalance}`;

    const walletSettingsMenu = Markup.inlineKeyboard([
      [Markup.button.callback("🔑 Export Private Key", "export_private_key")],
      [Markup.button.callback("❌ Close", "close_menu")],
    ]);

    return ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: walletSettingsMenu.reply_markup,
    });
  } catch (err) {
    console.error("Error in wallet settings menu:", err);
    return ctx.reply("❌ Something went wrong. Please try again.");
  }
}

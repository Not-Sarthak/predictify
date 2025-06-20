import { Context, Markup } from "telegraf";
import { getUserBalance } from "../helpers/get-user-balance";
import { generateAPIKeyAndWallet } from "../utils/polymarket/generate-user";
import { HOST, CHAIN_ID } from "../constants/polymarket";
import {
  generateMainMenuButtons,
  formatWelcomeMessage,
  handleStartCallbacks,
  handleSubscriptionMenuCallbacks,
  handleSubscriptionCallbacks,
  handleUnsubscriptionCallbacks,
  handleTradeCallbacks,
  handleCloseMenu,
  handleWalletSettingsMenuCallbacks,
} from "../utils/telegram";
import { supabase } from "./supabase";
import { handleExportPrivateKey } from "../helpers/export-user-private-key";

/* Command Handlers */
export async function handleStartCommand(ctx: Context) {
  try {
    const userId = ctx.from?.id;
    const userName = ctx.from?.username;

    const { data: existingUser, error: fetchError } = await supabase
      .from("Users")
      .select("*")
      .eq("id", userId)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 = No rows found; safe to ignore
      console.error("Error checking existing user:", fetchError);
      return ctx.reply("❌ Something went wrong. Please try again later.");
    }

    if (existingUser) {
      // User already exists
      const balance = await getUserBalance(existingUser.wallet_address);

      const message = formatWelcomeMessage(
        existingUser.wallet_address,
        balance.toString(),
        JSON.parse(existingUser.api_credentials)
      );

      const inlineKeyboard = Markup.inlineKeyboard(
        generateMainMenuButtons()
      ).reply_markup;

      return ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: inlineKeyboard,
      });
    }

    const walletData = await generateAPIKeyAndWallet({
      host: HOST,
      chainId: CHAIN_ID,
    });

    const address = walletData.address;
    const balance = await getUserBalance(address);

    const { error } = await supabase.from("Users").insert([
      {
        id: userId,
        telegram_username: userName,
        wallet_address: address,
        private_key: walletData.privateKey,
        api_credentials: JSON.stringify(walletData.apiCreds),
      },
    ]);

    if (error) {
      console.error("Error inserting new user:", error);
      return ctx.reply("❌ There was an error creating your account.");
    }

    const inlineKeyboard = Markup.inlineKeyboard(
      generateMainMenuButtons()
    ).reply_markup;

    const message = formatWelcomeMessage(
      address,
      balance.toString(),
      walletData.apiCreds
    );

    return ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: inlineKeyboard,
    });
  } catch (error) {
    console.error("Error generating wallet:", error);
    return ctx.reply("❌ Failed to generate wallet. Please try again.");
  }
}

/* Callback Query Handler */
export async function handleCallbackQuery(ctx: Context) {
  const data = (ctx.callbackQuery as any).data as string;

  // Handle Start Menu
  if (data.startsWith("start_")) {
    const action = data.split("_")[1];
    return handleStartCallbacks(ctx, action);
  }

  // Handle Subscription Menu
  if (data.startsWith("subscription_")) {
    const action = data.split("_")[1];
    return handleSubscriptionMenuCallbacks(ctx, action);
  }

  // Handle Subscription Callbacks
  if (data.startsWith("subscribe_")) {
    const category = data.split("_")[1];
    return handleSubscriptionCallbacks(ctx, category);
  }

  // Handle Unsubscription Callbacks
  if (data.startsWith("unsubscribe_")) {
    const category = data.split("_")[1];
    return handleUnsubscriptionCallbacks(ctx, category);
  }

  // Handle Trade Callbacks
  if (data.startsWith("buy_yes:")) {
    const marketId = data.split(":")[1];
    return handleTradeCallbacks(ctx, "yes", marketId);
  }

  if (data.startsWith("buy_no:")) {
    const marketId = data.split(":")[1];
    return handleTradeCallbacks(ctx, "no", marketId);
  }

  if (data === "wallet_settings_menu") {
    return handleWalletSettingsMenuCallbacks(ctx);
  }

  if (data === "export_private_key") {
    return handleExportPrivateKey(ctx);
  }

  // Handle Close Menu
  if (data === "close_menu") {
    return handleCloseMenu(ctx);
  }

  return ctx.answerCbQuery();
}

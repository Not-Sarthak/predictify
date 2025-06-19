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
  handleMySubscriptionsDisplay,
} from "../utils/telegram";

/* Command Handlers */
export async function handleStartCommand(ctx: Context) {
  try {
    const walletData = await generateAPIKeyAndWallet({
      host: HOST,
      chainId: CHAIN_ID,
    });

    const address = walletData.address;
    const balance = await getUserBalance(address);

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

export async function handleMySubscriptionsCommand(ctx: Context) {
  return handleMySubscriptionsDisplay(ctx);
}

/* Callback Query Handler */
export async function handleCallbackQuery(ctx: Context) {
  const data = (ctx.callbackQuery as any).data as string;
  const userId = ctx.from!.id.toString();

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

  // Handle Close Menu
  if (data === "close_menu") {
    return handleCloseMenu(ctx);
  }

  return ctx.answerCbQuery();
}

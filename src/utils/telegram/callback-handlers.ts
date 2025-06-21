import { Context, Markup } from "telegraf";
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
import { awaitingWalletDetailsInputSet } from "../../config/bot";
import { supabase } from "../../config/supabase";

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

export async function handleAddNewWalletCallback(ctx: Context) {
  const userId = ctx.from?.id.toString();

  try {
    const { count, error: countError } = await supabase
      .from("Copy_Wallets")
      .select("*", { count: "exact" })
      .eq("user_id", userId!);

    if (countError)
      throw new Error(countError.message, { cause: countError.cause });

    if (count === 3)
      return ctx.reply(`❌ You have reached your Maximum Wallet Limit`);
  } catch (error) {
    console.error("Error fetching user copy wallets details: ", error);
    return ctx.reply(
      `❌ There was an error fetching your details! Please try again.`,
      {
        parse_mode: "Markdown",
      }
    );
  }

  awaitingWalletDetailsInputSet.add(userId!);

  const message = `🧾 *Add Wallet Instructions*

Please enter your wallet in the following format:

\`<wallet_name> <wallet_address>\`

📌 *Example:*  
\`my_wallet 0x56687bf447db6ffa42ffe2204a05edaa20f55839\`
`;

  return ctx.reply(message, { parse_mode: "Markdown" });
}

export async function handleDeleteWalletCallback(ctx: Context) {
  const userId = ctx.from?.id.toString();

  try {
    const { data, error: countError } = await supabase
      .from("Copy_Wallets")
      .select("*")
      .eq("user_id", userId!);

    if (countError)
      throw new Error(countError.message, { cause: countError.cause });

    if (!data.length) return ctx.reply(`⚠️ You don't have any added Wallets!`);

    const deleteWalletButtons = Markup.inlineKeyboard(
      data.map((wallet) => {
        return [
          Markup.button.callback(
            `${wallet.wallet_name} (${wallet.wallet_address})`,
            `delete_copy_wallet:${wallet.wallet_address}`
          ),
        ];
      })
    );

    return ctx.reply(`Your Wallets: `, deleteWalletButtons);

    // const deleteWalletButtons = Markup.inlineKeyboard([]);
  } catch (error) {
    console.error("Error fetching user copy wallets details: ", error);
    return ctx.reply(
      `❌ There was an error fetching your wallet details! Please try again later.`,
      {
        parse_mode: "Markdown",
      }
    );
  }
}

export async function handleDeleteUserWallet(
  ctx: Context,
  walletAddress: string
) {
  const userId = ctx.from?.id.toString()!;

  try {
    const { error } = await supabase
      .from("Copy_Wallets")
      .delete()
      .filter("user_id", "eq", userId)
      .filter("wallet_address", "eq", walletAddress);

    if (error) throw new Error(error.message, { cause: error.cause });

    ctx.reply("✅ Wallet was Successfully deleted!");
  } catch (error) {
    console.error("Error deleting user copy wallet: ", error);
    return ctx.reply(
      `❌ There was an error deleting copy wallet! Please try again later.`,
      {
        parse_mode: "Markdown",
      }
    );
  }
}

export async function handleCloseMenu(ctx: Context) {
  await ctx.answerCbQuery("Menu closed");
  return ctx.editMessageReplyMarkup(undefined).catch(() => {});
}

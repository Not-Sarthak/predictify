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
import {
  formatActiveSubscriptionsMessage,
  formatCurrentTradePositionsMessage,
} from "./message-formatters";
import { NO_SUBSCRIPTIONS_MESSAGE } from "../../constants/telegram";
import {
  awaitingMarketTermInputSet,
  awaitingWalletDetailsInputSet,
} from "../../config/bot";
import { supabase } from "../../config/supabase";
import { getUserAddressFromId } from "../../helpers/get-user-address-from-id";
import { getUserPosition } from "../polymarket/get-user-position";
import type { InlineKeyboardButton } from "telegraf/types";

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

export async function handleViewTradePositions(ctx: Context) {
  const userId = ctx.from?.id!;
  const userAddress = await getUserAddressFromId(userId);

  if (!userAddress) {
    return ctx.reply(
      "⚠️ No associated wallet address found with your account!"
    );
  }

  const userPositions = await getUserPosition({
    user: "0xef7E2F8F5c7c8ae0Bfd1A7D55628616175BC25FB",
  }); // REPLACE THIS WITH THE BELOW LINE
  // const userPositions = await getUserPosition({ user: userAddress });

  const formattedUserPositionsMessages = formatCurrentTradePositionsMessage(
    userPositions.slice(0, 2)
  );

  for (const message of formattedUserPositionsMessages) {
    await ctx.reply(message, { parse_mode: "Markdown" });
  }
}

export async function handleManageTradePositionsCallback(
  ctx: Context,
  action: string
) {
  const userId = ctx.from?.id!;

  awaitingMarketTermInputSet.add(userId.toString());
  await redisClient.hSet(`user:order_action:${userId}`, {
    action: action === "open" ? "OPEN" : "CLOSE",
  });

  return ctx.reply(
    `✍️ *Enter a term to search*\n\n` +
      `<term>\n\n` +
      `Example:\n\`basketball\`\n\n` +
      `You can enter any keyword to get relevant results.`,
    { parse_mode: "Markdown" }
  );
}

export async function handleFetchMarketWithOffsetCallback(
  ctx: Context,
  queryText: string,
  action: "next" | "prev",
  offset: number
) {
  const newOffset = action === "next" ? offset + 5 : offset - 5;

  const response = await fetch(
    `https://gamma-api.polymarket.com/events?tag_slug=${queryText}&limit=5&offset=${newOffset}`
  );
  const marketData = await response.json();

  if (marketData.length == 0) {
    return ctx.reply("⚠️ There are no more markets!");
  }

  const marketTitleButtons: InlineKeyboardButton[][] = [];

  for (const market of marketData) {
    marketTitleButtons.push([
      Markup.button.callback(market.title, `selected_market:${market.id}`),
    ]);
  }

  const offsetButtons: InlineKeyboardButton[] = [];

  if (newOffset >= 5) {
    offsetButtons.push(
      Markup.button.callback(
        "⏮️ Prev",
        `fetch_markets:${queryText}:prev:${offset - 5}`
      )
    );
  }

  offsetButtons.push(
    Markup.button.callback(
      "Next ⏭️",
      `fetch_markets:${queryText}:next:${offset + 5}`
    )
  );

  marketTitleButtons.push(offsetButtons);

  await ctx.editMessageText("Markets: ", {
    reply_markup: Markup.inlineKeyboard(marketTitleButtons).reply_markup,
  });

  await ctx.answerCbQuery();
}

export async function handleSelectedMarketCallback(
  ctx: Context,
  marketId: string
) {
  const userId = ctx.from?.id.toString()!;

  const orderTypeButtons: InlineKeyboardButton[][] = [
    [
      Markup.button.callback(
        "Good Till Cancel",
        `selected_order:${marketId}:gtc`
      ),
    ],
    [
      Markup.button.callback(
        "Good Till Date",
        `selected_order:${marketId}:gtd`
      ),
    ],
    [
      Markup.button.callback(
        "Fill or Kill Order",
        `selected_order:${marketId}:fok`
      ),
    ],
    [
      Markup.button.callback(
        "Fill and Kill Order",
        `selected_order:${marketId}:fak`
      ),
    ],
  ];

  await ctx.editMessageText("Select Order Type: ", {
    reply_markup: Markup.inlineKeyboard(orderTypeButtons).reply_markup,
  });

  await ctx.answerCbQuery();
}

export async function handleCloseMenu(ctx: Context) {
  await ctx.answerCbQuery("Menu closed");
  return ctx.editMessageReplyMarkup(undefined).catch(() => {});
}

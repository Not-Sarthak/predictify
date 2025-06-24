import { Markup, type Context } from "telegraf";
import {
  awaitingMarketTermInputSet,
  awaitingOrderDetailsInputSet,
  awaitingWalletDetailsInputSet,
} from "../../config/bot";
import { supabase } from "../../config/supabase";
import { redisClient } from "../../config/redis";
import { getUserDetails } from "../../helpers/get-user-details";
import type { ApiKeyCreds } from "../../types/api-key";
import { buyOrderGTC } from "../polymarket-order/buy-order-gtc";
import { OrderType, Side } from "@polymarket/clob-client";
import { orderGTD } from "../polymarket-order/buy-and-sell-order-gtd";
import { marketBuyOrder } from "../polymarket-order/market-buy-order";
import { getTokenId } from "../../helpers/get-token-id";
import { PRIVATE_KEY } from "../../config/env";

export async function handleWalletDetailsTextMessage(
  ctx: Context,
  textMessage: string,
  userId: string
) {
  const [walletName, walletAddress] = textMessage?.split(/\s+/);

  if (!walletName || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return ctx.reply(
      "❌ Invalid format. Try again using:\n\n`<wallet_name> <wallet_address>`"
    );
  }

  try {
    const { error } = await supabase.from("Copy_Wallets").insert([
      {
        user_id: userId,
        wallet_name: walletName,
        wallet_address: walletAddress,
      },
    ]);

    if (error) throw new Error(error.message, { cause: error.cause });

    awaitingWalletDetailsInputSet.delete(userId!);
    return ctx.reply(`✅ Wallet *${walletName}* saved successfully!`, {
      parse_mode: "Markdown",
    });
  } catch (error) {
    console.error("Error Adding User Wallet in DB:", error);
    return ctx.reply(
      `❌ There Was an Error Adding Your Wallet! Please Try Again Later.`,
      {
        parse_mode: "Markdown",
      }
    );
  }
}

export async function handleMarketTermTextMessage(
  ctx: Context,
  textMessage: string,
  userId: string
) {
  const queryText = textMessage.split(/\s+/)[0];

  const response = await fetch(
    `https://gamma-api.polymarket.com/events?tag_slug=${queryText}&limit=5&offset=0`
  );

  const marketData = await response.json();

  const marketTitleButtons = [];
  for (const market of marketData) {
    marketTitleButtons.push([
      Markup.button.callback(
        market.markets[0].question,
        `selected_market:${market.markets[0].id}`
      ),
    ]);
  }
  marketTitleButtons.push([
    Markup.button.callback(
      "Next Markets ⏭️",
      `fetch_markets:${queryText}:next:5`
    ),
  ]);

  awaitingMarketTermInputSet.delete(userId);

  return ctx.reply("Markets: ", {
    reply_markup: Markup.inlineKeyboard(marketTitleButtons).reply_markup,
  });
}

export async function handleOrderDetailsTextMessage(
  ctx: Context,
  textMessage: string,
  userId: string
) {
  const [decision, price, size] = textMessage.split(/\s+/).slice(0, 3);

  const [orderContext, orderAction] = await Promise.all([
    redisClient.hGetAll(`user:order_context:${userId}`),
    redisClient.hGetAll(`user:order_action:${userId}`),
  ]);

  if (
    !orderContext.marketId ||
    !orderContext.orderType ||
    !orderAction.action
  ) {
    return ctx.reply(
      "❌ Something went wrong. Please try placing your order again."
    );
  }

  const { marketId, orderType } = orderContext;
  const { action } = orderAction;

  const [tokenId, userDetails] = await Promise.all([
    getTokenId(decision, marketId),
    getUserDetails(Number(userId)),
  ]);

  if (!tokenId) {
    return ctx.reply("⚠️ Error placing your order! Please try again later.");
  }

  const { private_key, api_credentials } = userDetails;
  const apiCreds: ApiKeyCreds = JSON.parse(api_credentials);

  try {
    if (orderType === "gtc") {
      action === "OPEN"
        ? await buyOrderGTC({
            size: Number(size),
            price: Number(price),
            orderType: OrderType.GTC,
            tokenId,
            side: Side.BUY,
            feeRateBps: 0,
            apiCreds,
            privateKey: PRIVATE_KEY, // NEED TO CHECK, WHICH PRIVATE KEY TO USE - FROM USER DATA OR ENV VARIABLE
          })
        : await buyOrderGTC({
            size: Number(size),
            price: Number(price),
            orderType: OrderType.GTC,
            tokenId,
            side: Side.SELL,
            feeRateBps: 0,
            apiCreds,
            privateKey: private_key,
          });
    } else if (orderType === "gtd") {
      action === "OPEN"
        ? await orderGTD({
            privateKey: private_key,
            creds: apiCreds,
            tokenId,
            price: Number(price),
            size: Number(size),
            expiration: 1000,
            side: Side.BUY,
          })
        : await orderGTD({
            privateKey: private_key,
            creds: apiCreds,
            tokenId,
            price: Number(price),
            size: Number(size),
            expiration: 1000,
            side: Side.SELL,
          });
    } else if (orderType === "fok") {
      action === "OPEN"
        ? await marketBuyOrder({
            privateKey: private_key,
            creds: apiCreds,
            tokenId,
            amount: Number(price),
            side: Side.BUY,
            orderType: OrderType.FOK,
          })
        : await marketBuyOrder({
            privateKey: private_key,
            creds: apiCreds,
            tokenId,
            amount: Number(price),
            side: Side.SELL,
            orderType: OrderType.FOK,
          });
    } else if (orderType === "fak") {
      action === "OPEN"
        ? await marketBuyOrder({
            privateKey: private_key,
            creds: apiCreds,
            tokenId,
            amount: Number(price),
            side: Side.BUY,
            orderType: OrderType.FAK,
          })
        : await marketBuyOrder({
            privateKey: private_key,
            creds: apiCreds,
            tokenId,
            amount: Number(price),
            side: Side.SELL,
            orderType: OrderType.FAK,
          });
    } else {
      return ctx.reply("❌ Invalid Order Type!");
    }

    ctx.reply("✅ Your Order is Placed!");
  } catch (error) {
    console.error("Error placing the order: ", error);
    return ctx.reply(
      "❌ There was an error placing your order! Please contact the bot owner."
    );
  } finally {
    awaitingOrderDetailsInputSet.delete(userId);
    await Promise.all([
      redisClient.del(`user:order_context:${userId}`),
      redisClient.del(`user:order_action:${userId}`),
    ]);
  }
}

import type { Context } from "telegraf";

import { awaitingOrderDetailsInputSet } from "@/bot";
import { redisClient } from "@/lib/redis";
import { db } from "@/lib/supabase";
import { getTokenId } from "@/helpers/get-token-id";
import { getUserDetails } from "@/helpers/get-user-details";
import type { ApiKeyCreds } from "@/shared/types/polymarket/api-key";
import { buyOrderGTC } from "@/utils/polymarket-order/buy-order-gtc";
import { OrderType, Side } from "@polymarket/clob-client";
import { orderGTD } from "@/utils/polymarket-order/buy-and-sell-order-gtd";
import { marketBuyOrder } from "@/utils/polymarket-order/market-buy-order";

export async function handleOrderDetailsTextMessage(
    ctx: Context,
    textMessage: string,
    userId: number
) {
    const [decision, price, size] = textMessage.split(/\s+/).slice(0, 3);

    const [orderContext, orderAction] = await Promise.all([
        redisClient.hGetAll(`user:order_context:${userId}`),
        redisClient.hGetAll(`user:order_action:${userId}`),
    ]);

    if (!orderContext.marketId || !orderContext.orderType || !orderAction.action) {
        return ctx.reply("❌ Something went wrong. Please try placing your order again.");
    }

    const { marketId, orderType } = orderContext;
    const { action } = orderAction;

    const [tokenId, userDetails] = await Promise.all([
        getTokenId(decision, marketId),
        getUserDetails(Number(userId)),
    ]);

    if (!tokenId || !userDetails) {
        return ctx.reply("⚠️ Error placing your order! Please try again later.");
    }

    const { private_key, api_credentials } = userDetails;
    const apiCreds: ApiKeyCreds = JSON.parse(api_credentials);
    const sentMessage = await ctx.reply("⏳ Placing your order...");

    let orderResponse;

    try {
        if (orderType === "gtc") {
            orderResponse =
                action === "OPEN"
                    ? await buyOrderGTC({
                          size: Number(size),
                          price: Number(price),
                          orderType: OrderType.GTC,
                          tokenId,
                          side: Side.BUY,
                          feeRateBps: 0,
                          apiCreds,
                          privateKey: private_key,
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
            const nowInSeconds = Math.floor(Date.now() / 1000);
            const expiration = nowInSeconds + 60 + 60; // NOW + 1 Minute (Security Threshold) + 60 Seconds

            orderResponse =
                action === "OPEN"
                    ? await orderGTD({
                          privateKey: private_key,
                          creds: apiCreds,
                          tokenId,
                          price: Number(price),
                          size: Number(size),
                          expiration,
                          side: Side.BUY,
                      })
                    : await orderGTD({
                          privateKey: private_key,
                          creds: apiCreds,
                          tokenId,
                          price: Number(price),
                          size: Number(size),
                          expiration,
                          side: Side.SELL,
                      });
        } else if (orderType === "fok") {
            orderResponse =
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
            orderResponse =
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

        if (orderResponse?.error) {
            return await ctx.telegram.editMessageText(
                ctx.chat!.id,
                sentMessage.message_id,
                undefined,
                `❌ Error placing your order! Please try again.\n${orderResponse.error}`
            );
        }

        const amountToAdd =
            orderType === "gtc" || orderType === "gtd"
                ? Number(price) * Number(size)
                : Number(price);

        if (action === "OPEN") {
            try {
                const { data } = await db("Users")
                    .select("amount_deposited")
                    .eq("id", userId)
                    .single();

                await db("Users")
                    .update({ amount_deposited: data?.amount_deposited! + amountToAdd })
                    .eq("id", userId);
            } catch (error) {
                console.error("Error adding Volume amount: ", error);
            }
        }

        await ctx.telegram.editMessageText(
            ctx.chat!.id,
            sentMessage.message_id,
            undefined,
            "✅ Your Order is Placed!"
        );

        ctx.reply(`🧾 Your Order ID: ${orderResponse?.response.orderID}`);
    } catch (error) {
        console.error("Error placing the order: ", error);
        return ctx.reply("❌ There was an error placing your order! Please contact the bot owner.");
    } finally {
        awaitingOrderDetailsInputSet.delete(userId.toString());
        await Promise.all([
            redisClient.del(`user:order_context:${userId}`),
            redisClient.del(`user:order_action:${userId}`),
        ]);
    }
}

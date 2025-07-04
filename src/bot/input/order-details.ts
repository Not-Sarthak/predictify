import type { Context } from "telegraf";

import { awaitingOrderDetailsInputSet } from "@/bot";
import { redisClient } from "@/lib/redis";
import { db } from "@/lib/supabase";
import { getTokenId } from "@/helpers/get-token-id";
import { getUserDetails } from "@/helpers/get-user-details";
import type { ApiKeyCreds } from "@/shared/types/polymarket/api-key";
import { buyOrderGTC } from "@/utils/polymarket-order/buy-order-gtc";
import { OrderType, Side } from "@polymarket/clob-client";
import { ensureTokenApproval, marketBuyOrder } from "@/utils/polymarket-order/market-buy-order";
import { sellOrder } from "@/utils/polymarket-order/sell-order";
import { feeTransaction, transferFeeToTreasury } from "@/utils/fees/fee";
import { ethers } from "ethers";

export async function handleOrderDetailsTextMessage(
    ctx: Context,
    textMessage: string,
    userId: number
) {
    const orderContext = await redisClient.hGetAll(`user:order_context:${userId}`);

    if (!orderContext.marketId || !orderContext.orderType) {
        return ctx.reply("❌ Something went wrong. Please try placing your order again.");
    }

    const { marketId, orderType, side } = orderContext;
    const userDetails = await getUserDetails(Number(userId));

    if (!userDetails) {
        return ctx.reply("⚠️ Error fetching your account details! Please try again later.");
    }

    const { private_key, api_credentials } = userDetails;
    const apiCreds: ApiKeyCreds = JSON.parse(api_credentials);

    const sentMessage = await ctx.reply("⏳ Placing your order...");
    let orderResponse;

    try {
        if (orderType === "gtc") {
            // Limit Order: expects "<price> <size>"
            const [price, size] = textMessage.split(/\s+/).slice(0, 2);

            if (!price || !size || isNaN(Number(price)) || isNaN(Number(size))) {
                return ctx.reply(
                    "❌ Invalid format! Please use: `<price> <size>`\nExample: `0.65 100`",
                    { parse_mode: "Markdown" }
                );
            }

            const tokenId = await getTokenId(side.toLowerCase(), marketId);
            if (!tokenId) {
                return ctx.reply("⚠️ Error fetching market details! Please try again later.");
            }

            orderResponse = await buyOrderGTC({
                size: Number(size),
                price: Number(price),
                orderType: OrderType.GTC,
                tokenId,
                side: Side.BUY,
                feeRateBps: 0,
                apiCreds,
                privateKey: private_key,
            });
        } else if (orderType === "fok") {
            // Market Order: expects "<amount>"
            const amount = Number(textMessage.trim());

            if (isNaN(amount) || amount <= 0) {
                return ctx.reply(
                    "❌ Invalid amount! Please enter a valid USDC amount.\nExample: `50`",
                    { parse_mode: "Markdown" }
                );
            }

            const tokenId = await getTokenId(side.toLowerCase(), marketId);
            if (!tokenId) {
                return ctx.reply("⚠️ Error fetching market details! Please try again later.");
            }

            const { finalAmount } = feeTransaction(amount);

            orderResponse = await marketBuyOrder({
                privateKey: private_key,
                creds: apiCreds,
                tokenId,
                amount: finalAmount,
                side: Side.BUY,
                orderType: OrderType.FOK,
            });
        } else if (orderType === "fok_sell") {
            // Sell Position: expects "<size>"
            const size = Number(textMessage.trim());

            if (isNaN(size) || size <= 0) {
                return ctx.reply(
                    "❌ Invalid size! Please enter a valid number of shares.\nExample: `25`",
                    { parse_mode: "Markdown" }
                );
            }

            // For sell orders, we need to determine which token (YES/NO) the user wants to sell
            // This could be enhanced to show user's positions and let them choose
            // For now, we'll use a simple approach - ask user to specify
            const tokenIdYes = await getTokenId("yes", marketId);
            const tokenIdNo = await getTokenId("no", marketId);

            if (!tokenIdYes || !tokenIdNo) {
                return ctx.reply("⚠️ Error fetching market details! Please try again later.");
            }

            // Use a default sell price for FOK - this should ideally be market price
            const sellPrice = 0.5; // This should be fetched from current market price

            orderResponse = await sellOrder({
                tokenId: tokenIdYes, // Default to YES token - this should be user-selectable
                size: size,
                price: sellPrice,
                orderType: OrderType.FOK,
                creds: apiCreds,
            });
        } else {
            return ctx.reply("❌ Invalid Order Type!");
        }

        if (orderResponse?.error) {
            return await ctx.telegram.editMessageText(
                ctx.chat!.id,
                sentMessage.message_id,
                undefined,
                `❌ Error placing your order!\n\n${orderResponse.error}`
            );
        }

        // Update user stats for successful orders
        if (orderType !== "fok_sell") {
            try {
                const amount =
                    orderType === "gtc"
                        ? Number(textMessage.split(/\s+/)[0]) * Number(textMessage.split(/\s+/)[1])
                        : Number(textMessage.trim());

                const { fee, finalAmount } = feeTransaction(amount);
                const { data } = await db("Users").select("*").eq("id", userId).single();

                await db("Users")
                    .update({
                        amount_deposited: data?.amount_deposited || 0 + finalAmount,
                        fees_total: data?.fees_total || 0 + fee,
                    })
                    .eq("id", userId);
            } catch (error) {
                console.error("Error updating volume & fees: ", error);
            }
        }

        // Success response
        await Promise.all([
            ctx.telegram.editMessageText(
                ctx.chat!.id,
                sentMessage.message_id,
                undefined,
                "✅ Your Order is Placed!"
            ),
            ctx.reply(
                `🧾 **Order Confirmation**\n\nOrder ID: \`${orderResponse?.response.orderID}\`\nType: ${orderType.toUpperCase()}\nSide: ${side}`,
                { parse_mode: "Markdown" }
            ),
        ]);

        // Transfer fees for buy orders
        if (orderType !== "fok_sell") {
            const amount =
                orderType === "gtc"
                    ? Number(textMessage.split(/\s+/)[0]) * Number(textMessage.split(/\s+/)[1])
                    : Number(textMessage.trim());

            await transferFeeToTreasury({
                userWallet: new ethers.Wallet(private_key),
                positionAmount: amount,
                transactionType: "OPEN",
            });
        }

        await ensureTokenApproval(private_key);
    } catch (error) {
        console.error("Error placing the order: ", error);
        await ctx.telegram.editMessageText(
            ctx.chat!.id,
            sentMessage.message_id,
            undefined,
            "❌ There was an error placing your order! Please contact support."
        );
    } finally {
        awaitingOrderDetailsInputSet.delete(userId.toString());
        await redisClient.del(`user:order_context:${userId}`);
    }
}

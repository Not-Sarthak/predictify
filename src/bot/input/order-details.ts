import { Markup, type Context } from "telegraf";
import { redisClient } from "@/lib/redis";
import { db } from "@/lib/supabase";
import { getTokenId } from "@/helpers/get-token-id";
import { getUserDetails } from "@/helpers/get-user-details";
import type { ApiKeyCreds } from "@/types/polymarket/api-key";
import { buyOrderGTC } from "@/utils/polymarket-order/buy-order-gtc";
import { OrderType, Side } from "@polymarket/clob-client";
import {
    ensureTokenApproval,
    marketBuyOrder,
    marketSellOrder,
} from "@/utils/polymarket-order/market-buy-order";
import { feeTransaction, transferFeeToTreasury } from "@/utils/fees/fee";
import { ethers } from "ethers";
import { decryptPrivateKey } from "@/utils/crypto";
import { getMarketQuestion } from "@/bot/utils/get-market-question";
import { getUserIdFromCtx } from "@/bot/utils";
import { getUserPositionByMarket } from "@/utils/polymarket/get-user-position";
import { getUserAddressFromId } from "@/helpers/get-user-address-from-id";
import { ADMIN_USERS_ID } from "@/shared/constants/misc";
import { clearUserInputState } from "@/bot/input/state";

export async function handleOrderDetailsTextMessage(ctx: Context, textMessage: string) {
    const userId = getUserIdFromCtx(ctx);
    const orderContext = await redisClient.hGetAll(`user:order_context:${userId}`);

    if (!orderContext.marketId || !orderContext.orderType) {
        return ctx.reply("❌ Something went wrong. Please try placing your order again.");
    }

    const { marketId, orderType, side } = orderContext;
    const [userDetails, marketQuestion] = await Promise.all([
        getUserDetails(Number(userId)),
        getMarketQuestion(marketId),
    ]);

    if (!userDetails) {
        return ctx.reply("⚠️ Error fetching your account details! Please try again later.");
    }

    await clearUserInputState(userId.toString());
    await redisClient.del(`user:order_context:${userId}`);

    const { private_key, api_credentials } = userDetails;
    const decryptedPrivateKey = decryptPrivateKey(private_key);
    const apiCreds: ApiKeyCreds = JSON.parse(api_credentials);

    const sentMessage = await ctx.reply("⏳ Placing your order...");
    let orderResponse;
    let position: any;
    let isOrderSizeGreaterThanOrEqualTo20 = true;

    if (orderType === "gtc") {
        const [price, size] = textMessage.split(/\s+/).slice(0, 2);
        isOrderSizeGreaterThanOrEqualTo20 = Number(price) * Number(size) >= 20;
    } else if (orderType === "fok") {
        const amount = Number(textMessage.trim());
        isOrderSizeGreaterThanOrEqualTo20 = amount >= 20;
    }

    if (!isOrderSizeGreaterThanOrEqualTo20 && !ADMIN_USERS_ID.includes(userId)) {
        return await ctx.telegram.editMessageText(
            ctx.chat!.id,
            sentMessage.message_id,
            undefined,
            "❌ Order Size must be at least 20."
        );
    }

    try {
        if (orderType === "gtc") {
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
                privateKey: decryptedPrivateKey,
            });
        } else if (orderType === "fok") {
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
                privateKey: decryptedPrivateKey,
                creds: apiCreds,
                tokenId,
                amount: finalAmount,
                side: Side.BUY,
                orderType: OrderType.FOK,
            });
        } else if (orderType === "fok_sell") {
            const isAutoExecute = orderContext.autoExecute === "true";
            const amount = isAutoExecute ? Number(orderContext.amount) : Number(textMessage.trim());

            if (isNaN(amount) || amount <= 0) {
                return ctx.reply(
                    "❌ Invalid amount! Please enter a valid number of shares.\nExample: `25`",
                    { parse_mode: "Markdown" }
                );
            }

            if (orderContext.maxSize) {
                const maxSize = Number(orderContext.maxSize);
                if (amount > maxSize) {
                    return ctx.reply(
                        `❌ You only have ${maxSize} shares. Please enter a valid amount.`,
                        { parse_mode: "Markdown" }
                    );
                }
            }

            const userAddress = await getUserAddressFromId(userId);
            if (!userAddress) {
                return ctx.reply("⚠️ Error fetching your wallet address!");
            }

            position = await getUserPositionByMarket(userAddress, marketId);
            if (!position || position.size <= 0) {
                return ctx.reply("❌ You don't have any shares in this market to sell.");
            }

            const tokenId = await getTokenId(position.outcome.toLowerCase(), marketId);

            if (!tokenId) {
                return ctx.reply("⚠️ Error fetching market details! Please try again later.");
            }

            orderResponse = await marketSellOrder({
                privateKey: decryptedPrivateKey,
                creds: apiCreds,
                tokenId: tokenId,
                amount: amount,
                orderType: OrderType.FOK,
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

        const amount =
            orderType === "gtc"
                ? Number(textMessage.split(/\s+/)[0]) * Number(textMessage.split(/\s+/)[1])
                : orderType === "fok_sell"
                  ? orderContext.autoExecute === "true"
                      ? Number(orderContext.amount)
                      : Number(textMessage.trim())
                  : Number(textMessage.trim());

        const { fee, finalAmount } = feeTransaction(amount);
        const { data } = await db("Users").select("*").eq("id", userId).single();

        if (orderType !== "fok_sell") {
            try {
                await db("Users")
                    .update({
                        amount_deposited: data?.amount_deposited || 0 + finalAmount,
                        fees_total: data?.fees_total || 0 + fee,
                    })
                    .eq("id", userId);
            } catch (error) {
                console.error("Error updating Amount Deposited & Fees: ", error);
            }
        }

        try {
            await db("Users")
                .update({
                    total_volume: data?.total_volume || 0 + finalAmount,
                })
                .eq("id", userId);
        } catch (error) {
            console.error("Error updating Volume: ", error);
        }

        const orderPlaceAmountToShow =
            orderType === "gtc"
                ? Number(textMessage.split(/\s+/)[0]) * Number(textMessage.split(/\s+/)[1])
                : orderType === "fok_sell"
                  ? orderContext.autoExecute === "true"
                      ? Number(orderContext.amount)
                      : Number(textMessage.trim())
                  : Number(textMessage.trim());

        const polygonScanMsg =
            orderType !== "fok_sell"
                ? `
<a href="https://polygonscan.com/tx/${orderResponse?.response?.tx}">View on Polygonscan</a>

`
                : `

`;

        const orderPlacedMessage =
            orderType === "fok_sell"
                ? `✅ Your Sell Order is Placed!\n\n` +
                  `Market: ${marketQuestion}\n` +
                  `Shares Sold: ${orderPlaceAmountToShow}\n` +
                  `Outcome: ${position?.outcome || "Unknown"}`
                : `✅ Your Order is Placed!` +
                  `${polygonScanMsg}` +
                  `Market: ${marketQuestion}
Amount: ${orderPlaceAmountToShow} | Side: ${side}
`;

        await ctx.telegram.editMessageText(
            ctx.chat!.id,
            sentMessage.message_id,
            undefined,
            orderPlacedMessage,
            {
                parse_mode: "HTML",
                reply_markup: Markup.inlineKeyboard([
                    Markup.button.url(
                        "📊 Track My Order",
                        `https://polymarket.com/profile/${userDetails.wallet_address}`
                    ),
                ]).reply_markup,
            }
        );

        if (orderType !== "fok_sell") {
            const amount =
                orderType === "gtc"
                    ? Number(textMessage.split(/\s+/)[0]) * Number(textMessage.split(/\s+/)[1])
                    : Number(textMessage.trim());

            await transferFeeToTreasury({
                userWallet: new ethers.Wallet(decryptedPrivateKey),
                positionAmount: amount,
                transactionType: "OPEN",
                userId: userId,
            });
        }

        await ensureTokenApproval(decryptedPrivateKey);
    } catch (error) {
        console.error("Error placing the order: ", error);
        await ctx.telegram.editMessageText(
            ctx.chat!.id,
            sentMessage.message_id,
            undefined,
            "❌ Error Placing Order"
        );
    }
}

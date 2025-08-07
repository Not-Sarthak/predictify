import { Markup, type Context } from "telegraf";
import { redisClient } from "../../lib/redis";
import { db } from "../../lib/supabase";
import { getTokenId } from "../../helpers/get-token-id";
import { getUserDetails } from "../../helpers/get-user-details";
import type { ApiKeyCreds } from "../../types/polymarket/api-key";
import { buyOrderGTC } from "../../utils/polymarket-order/buy-order-gtc";
import { OrderType, Side } from "@polymarket/clob-client";
import {
    ensureTokenApproval,
    marketBuyOrder,
    marketSellOrder,
} from "../../utils/polymarket-order/market-buy-order";
import { feeTransaction, transferFeeToTreasury } from "../../utils/fees/fee";
import { ethers } from "ethers";
import { decryptPrivateKey } from "../../utils/crypto";
import { getUserIdFromCtx, getUsernameFromCtx } from "../utils";
import { getUserPositionByMarket } from "../../utils/polymarket/get-user-position";
import { getUserAddressFromId } from "../../helpers/get-user-address-from-id";
import { ADMIN_USERS_ID } from "../../shared/constants/misc";
import { clearUserInputState } from "../input/state";
import { getMarketByConditionId, getMarketById } from "../../utils/polymarket/get-markets";
import { cancelOrder } from "../../utils/polymarket-order/cancel-order";
import { getUserWrappedUSDCBalance } from "../../helpers/get-user-balance";
import { getLockedBalance } from "../../utils/polymarket/get-locked-balance";
import { generatePositionCard } from "../../utils/card-generator";
import { encodeMarketId } from "../../utils/encoding";
import { trackManualTrade } from "../../utils/trade-tracker";
import { updateUserVolume } from "../../helpers/update-user-volume";
import { startUserTradeWatcher } from "../../notifier/ws/limit-order-watcher";

export async function handleOrderDetailsTextMessage(ctx: Context, textMessage: string) {
    const userId = getUserIdFromCtx(ctx);
    const orderContext = await redisClient.hGetAll(`user:order_context:${userId}`);

    if (!orderContext.marketId || !orderContext.orderType) {
        return ctx.reply("❌ Something went wrong. Please try placing your order again.");
    }

    const { marketId, orderType, side, cancel, orderId: prevOrderId } = orderContext;
    const fetchMarketById = marketId.startsWith("0x") ? getMarketByConditionId : getMarketById;

    const [userDetails, market] = await Promise.all([
        getUserDetails(Number(userId)),
        fetchMarketById(marketId),
    ]);

    if (!userDetails) {
        return ctx.reply("⚠️ Error fetching your account details! Please try again later.");
    }

    if (!market) {
        return ctx.reply("⚠️ Error fetching market details! Please try again later.");
    }

    const username = getUsernameFromCtx(ctx);

    await clearUserInputState(userId.toString());
    await redisClient.del(`user:order_context:${userId}`);

    const { private_key, api_credentials } = userDetails;
    const decryptedPrivateKey = decryptPrivateKey(private_key);
    const apiCreds: ApiKeyCreds = JSON.parse(api_credentials);

    const sentMessage = await ctx.reply("⏳ Placing your order...");
    let orderResponse;
    let position: any;
    let isMinimumAmount = true;
    let executionPrice = 0;
    let shares = 0;

    const [userBalance, lockedBalance] = await Promise.all([
        getUserWrappedUSDCBalance(userDetails.wallet_address),
        getLockedBalance(userId),
    ]);

    if (orderType === "fok") {
        const amount = Number(textMessage.trim());
        isMinimumAmount = amount >= 10;

        if (amount > userBalance - lockedBalance) {
            return ctx.telegram.editMessageText(
                ctx.chat!.id,
                sentMessage.message_id,
                undefined,
                "❌ Not Enough Funds."
            );
        }
    } else if (orderType === "gtc") {
        const [_1, amountStr, _] = textMessage.trim().split(/\s+/);
        const amount = Number(amountStr);

        if (amount > userBalance - lockedBalance) {
            return ctx.telegram.editMessageText(
                ctx.chat!.id,
                sentMessage.message_id,
                undefined,
                "❌ Not Enough Funds."
            );
        }
    }

    if (!isMinimumAmount && !ADMIN_USERS_ID.includes(userId)) {
        return await ctx.telegram.editMessageText(
            ctx.chat!.id,
            sentMessage.message_id,
            undefined,
            "❌ Order Size must be at least 10."
        );
    }

    try {
        if (orderType === "gtc") {
            if (cancel === "true") {
                const response = await cancelOrder({
                    privateKey: decryptPrivateKey(userDetails.private_key),
                    creds: apiCreds,
                    orderIds: [prevOrderId],
                });

                if (response.not_canceled.length > 0) {
                    return ctx.reply("❌ There was an Error.");
                }
            }

            const [priceStr, amountStr, _] = textMessage.trim().split(/\s+/);

            const limitPrice = Number(priceStr);
            const amount = Number(amountStr);
            if (isNaN(limitPrice) || isNaN(amount) || limitPrice <= 0 || amount <= 0) {
                return ctx.reply("❌ Invalid format. Use: `<price> <amount>`", {
                    parse_mode: "Markdown",
                });
            }

            const currentPrice =
                side === "YES"
                    ? JSON.parse(market.outcomePrices)[0]
                    : JSON.parse(market.outcomePrices)[1];

            const isExecutableNow = currentPrice <= limitPrice;
            executionPrice = isExecutableNow ? currentPrice : limitPrice;
            shares = amount / executionPrice;

            const tokenId = await getTokenId(side.toLowerCase(), marketId);
            if (!tokenId) {
                return ctx.reply("⚠️ Error fetching market details! Please try again later.");
            }

            orderResponse = await buyOrderGTC({
                size: shares,
                price: executionPrice,
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

            if (orderResponse && !orderResponse.error) {
                await trackManualTrade(userId, tokenId, "BUY", finalAmount / executionPrice);
                await updateUserVolume(userId, finalAmount);
            }
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

            // Track manual sell order and update volume
            if (orderResponse && !orderResponse.error) {
                await trackManualTrade(userId, tokenId, "SELL", amount);
                const market = await getMarketByConditionId(marketId);
                const currentPrice =
                    position.outcome.toLowerCase() === "yes"
                        ? JSON.parse(market.outcomePrices)[0]
                        : JSON.parse(market.outcomePrices)[1];
                const sellVolume = amount * currentPrice;
                await updateUserVolume(userId, sellVolume);
            }
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
                        amount_deposited: (data?.amount_deposited || 0) + finalAmount,
                        fees_total: (data?.fees_total || 0) + fee,
                    })
                    .eq("id", userId);
            } catch (error) {
                console.error("Error updating Amount Deposited & Fees: ", error);
            }
        }

        try {
            await db("Users")
                .update({
                    total_volume: (data?.total_volume || 0) + finalAmount,
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

        const txHash = orderResponse?.response.transactionsHashes
            ? orderResponse?.response.transactionsHashes[0]
            : null;
        const orderId = orderResponse?.response.orderID;

        if (orderResponse?.response.success) {
            const polygonScanMsg = txHash
                ? `\n<a href="https://polygonscan.com/tx/${txHash}">View on Polygonscan</a>\n`
                : "\n";

            const orderPlacedMessage =
                orderType === "fok_sell"
                    ? `✅ Your Sell Order was Placed!\n\n` +
                      `<b>Market:</b> ${market.question}\n` +
                      `<b>Shares Sold:</b> ${orderPlaceAmountToShow}\n` +
                      `<b>Outcome:</b> ${position?.outcome || "Unknown"}\n` +
                      polygonScanMsg
                    : `✅ <b>Your Buy Order Was Placed!</b>\n\n` +
                      `<b>Status:</b> ${orderResponse.response.status.toUpperCase()}\n` +
                      `<b>Market:</b> ${market.question}\n` +
                      `<b>Amount:</b> ${orderPlaceAmountToShow} | <b>Side:</b> ${side}\n` +
                      polygonScanMsg;

            const button_callback_data =
                orderType === "gtc"
                    ? orderResponse.response.status === "matched"
                        ? "show_portfolio"
                        : "view_cancel_order_menu"
                    : "show_portfolio";

            if (orderType === "gtc" && orderResponse.response.status !== "matched") {
                startUserTradeWatcher(
                    userId.toString(),
                    JSON.parse(userDetails.api_credentials),
                    marketId
                );
            }

            const amount =
                orderType === "gtc"
                    ? Number(textMessage.split(/\s+/)[0]) * Number(textMessage.split(/\s+/)[1])
                    : Number(textMessage.trim());

            const currentPrice =
                side === "YES"
                    ? JSON.parse(market.outcomePrices)[0]
                    : JSON.parse(market.outcomePrices)[1];

            const volume = Math.floor(Number(market.volume)).toLocaleString("en-US");
            const closeDate = new Date().toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
            });
            const toWin = amount / currentPrice;
            const odds = Number((currentPrice * 100).toFixed(2));

            await ctx.telegram.editMessageText(
                ctx.chat!.id,
                sentMessage.message_id,
                undefined,
                orderPlacedMessage,
                {
                    parse_mode: "HTML",
                    reply_markup: Markup.inlineKeyboard([
                        [Markup.button.callback("📊 Track My Order", button_callback_data)],
                        [
                            Markup.button.callback(
                                "🔔 Set Price Alert",
                                `set_price_alert:${encodeMarketId(market.conditionId)}`
                            ),
                            Markup.button.callback(
                                "💸 Take Profit",
                                `take_profit:${encodeMarketId(market.conditionId)}`
                            ),
                            Markup.button.callback(
                                "🛑 Stop Loss",
                                `stop_loss:${encodeMarketId(market.conditionId)}`
                            ),
                        ],
                    ]).reply_markup,
                }
            );
            redisClient.rPush(`user:order_ids:${userId}`, orderId);

            if (orderResponse.response.status === "matched") {
                const imgBuffer = await generatePositionCard(
                    username,
                    market.question,
                    side,
                    volume,
                    closeDate,
                    toWin,
                    odds,
                    amount,
                    userDetails.show_username_in_cards
                );

                await ctx.replyWithPhoto({ source: imgBuffer });
            }

            if (orderType === "gtc") {
                await db("Users")
                    .update({
                        total_balance: userBalance - amount,
                    })
                    .eq("id", userId);
            }

            if (orderType !== "fok_sell") {
                await transferFeeToTreasury({
                    userWallet: new ethers.Wallet(decryptedPrivateKey),
                    positionAmount: amount,
                    transactionType: "OPEN",
                    userId: userId,
                });
            }

            await ensureTokenApproval(decryptedPrivateKey);
        } else {
            await ctx.telegram.editMessageText(
                ctx.chat!.id,
                sentMessage.message_id,
                undefined,
                "❌ Error Placing Order"
            );
        }
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

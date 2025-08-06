import type { Context } from "telegraf";

import { getUserIdFromCtx } from "../utils";
import { handleWalletDetailsTextMessage } from "../input/wallet-details";
import { handleMarketTermTextMessage } from "../input/market-term";
import { handleWalletMontiorTextMessage } from "../input/wallet-monitor";
import { handleConfigTextMessage } from "../input/config-details";
// import { handleReferralCodeTextMessage } from "../input/referral-code";
import { handleCloseOpenPosition, handleConfirmOrder, handleShowMarkets } from "../callbacks/trade";
import { handleWithdrawalInput } from "../../utils/withdrawal/index";
import { getUserInputState } from "../input/state";
import { redisClient } from "../../lib/redis";
import { handleCustomCategoryInput } from "../callbacks/subscriptions";
import { handleSetMarketPriceAlert } from "../input/price_alert";
import { handleTakeProfitOrStopLossExecution, handleTpSlShareInput } from "../input/price-tp-sl";
import { getEventBySlug } from "../../utils/polymarket/get-markets";
import { handleEditPriceAlert } from "../input/edit-price-alert";
import { handleSetWalletPercentage } from "../callbacks/autotrade";
import {
    handleHighProbAutoSplitAmount,
    handleHighProbManualAmount,
} from "../input/high-probability";

export async function handleUserTextMessage(ctx: Context) {
    const textMessage = ctx.text?.trim();
    if (!textMessage) return;

    const userId = getUserIdFromCtx(ctx);
    const flow = await getUserInputState(userId.toString());
    if (!flow) {
        return ctx.reply("❌ I didn't understand that. Use the menu.");
    }

    if (textMessage.startsWith("https://polymarket.com/event/")) {
        const slug = textMessage.split("/")[4];
        const eventData = await getEventBySlug(slug);
        const id = eventData?.marketInfo.id;

        return handleShowMarkets(ctx, id);
    }

    switch (flow) {
        // TEMPORARILY DISABLED - Bot is open for everyone
        // case "referral":
        //     await handleReferralCodeTextMessage(ctx, textMessage);
        //     break;
        case "walletDetails":
            await handleWalletDetailsTextMessage(ctx, textMessage, userId);
            break;
        case "orderDetails":
            await handleConfirmOrder(ctx, textMessage);
            break;
        case "close_position":
            const orderContext = await redisClient.hGetAll(`user:order_context:${userId}`);
            const { marketId } = orderContext;
            await handleCloseOpenPosition(ctx, marketId, Number(textMessage));
            break;
        case "marketTerm":
            await handleMarketTermTextMessage(ctx, textMessage);
            break;
        case "walletMonitor":
            await handleWalletMontiorTextMessage(ctx, textMessage, userId);
            break;
        case "config":
            const configKey = await redisClient.hGet(`user:config_input:${userId}`, "key");
            await handleConfigTextMessage(ctx, textMessage, userId, configKey as string);
            break;
        case "withdrawal":
            await handleWithdrawalInput(ctx, textMessage);
            break;
        case "custom_category":
            await handleCustomCategoryInput(ctx, textMessage);
            break;
        case "set_price_alert":
            await handleSetMarketPriceAlert(ctx, textMessage);
            break;
        case "tp_sl_share_input":
            await handleTpSlShareInput(ctx, textMessage);
            break;
        case "tp_sl_price_input":
            await handleTakeProfitOrStopLossExecution(ctx, textMessage);
            break;
        case "edit_price_alert":
            await handleEditPriceAlert(ctx, textMessage);
            break;
        case "wallet_percentage":
            const walletData = await redisClient.hGetAll(`user:config_input:${userId}`);
            const walletAddress = walletData.walletAddress;
            if (!walletAddress) {
                return ctx.reply("❌ Error: Wallet address not found. Please try again.");
            }
            await handleSetWalletPercentage(ctx, walletAddress, textMessage);
            break;
        case "highprob_autosplit_amount":
            await handleHighProbAutoSplitAmount(ctx, textMessage);
            break;
        case "highprob_manual_amount":
            await handleHighProbManualAmount(ctx, textMessage);
            break;
        default:
            return ctx.reply("❌ Unknown input context. Please try again.");
    }
}

import type { Context } from "telegraf";

import { getUserIdFromCtx } from "@/bot/utils";
import { handleWalletDetailsTextMessage } from "@/bot/input/wallet-details";
import { handleMarketTermTextMessage } from "@/bot/input/market-term";
import { handleWalletMontiorTextMessage } from "@/bot/input/wallet-monitor";
import { handleConfigTextMessage } from "@/bot/input/config-details";
import { handleReferralCodeTextMessage } from "@/bot/input/referral-code";
import { handleCloseOpenPosition, handleConfirmOrder } from "@/bot/callbacks/trade";
import { handleWithdrawalInput } from "@/utils/withdrawal/index";
import { getUserInputState } from "@/bot/input/state";
import { redisClient } from "@/lib/redis";
import { handleCustomCategoryInput } from "@/bot/callbacks/subscriptions";

export async function handleUserTextMessage(ctx: Context) {
    const textMessage = ctx.text?.trim();
    if (!textMessage) return;

    const userId = getUserIdFromCtx(ctx);
    const flow = await getUserInputState(userId.toString());
    if (!flow) {
        return ctx.reply("❌ I didn't understand that. Use the menu.");
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
        default:
            return ctx.reply("❌ Unknown input context. Please try again.");
    }
}

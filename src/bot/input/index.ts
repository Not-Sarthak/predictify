import type { Context } from "telegraf";

import {
    awaitingConfigInputSet,
    awaitingMarketTermInputSet,
    awaitingOrderDetailsInputSet,
    awaitingWalletDetailsInputSet,
    awaitingWalletMonitorInputSet,
    awaitingReferralCodeInputSet,
    awaitingWithdrawalInputSet,
} from "@/bot";
import { getUserIdFromCtx } from "@/bot/utils";
import { handleWalletDetailsTextMessage } from "@/bot/input/wallet-details";
import { handleMarketTermTextMessage } from "@/bot/input/market-term";
import { handleWalletMontiorTextMessage } from "@/bot/input/wallet-monitor";
import { handleConfigTextMessage } from "@/bot/input/config-details";
import { handleReferralCodeTextMessage } from "@/bot/input/referral-code";
import { handleConfirmOrder } from "@/bot/callbacks/trade";
import { handleWithdrawalInput } from "@/utils/withdrawal/index";

export async function handleUserTextMessage(ctx: Context) {
    const textMessage = ctx.text?.trim();
    if (!textMessage) return;

    const userId = getUserIdFromCtx(ctx);

    // Handle referral code input first
    if (awaitingReferralCodeInputSet.has(userId.toString())) {
        return handleReferralCodeTextMessage(ctx, textMessage);
    }

    // TODO:FIX - REFACTOR TEXT HANDLERS

    if (awaitingWalletDetailsInputSet.has(userId.toString())) {
        return handleWalletDetailsTextMessage(ctx, textMessage, userId);
    }

    if (awaitingOrderDetailsInputSet.has(userId.toString())) {
        return handleConfirmOrder(ctx, textMessage);
    }

    if (awaitingMarketTermInputSet.has(userId.toString())) {
        return handleMarketTermTextMessage(ctx, textMessage);
    }

    if (awaitingWalletMonitorInputSet.has(userId.toString())) {
        return handleWalletMontiorTextMessage(ctx, textMessage, userId);
    }

    if (awaitingConfigInputSet.has(userId.toString())) {
        return handleConfigTextMessage(
            ctx,
            textMessage,
            userId,
            awaitingConfigInputSet.get(userId.toString())!
        );
    }

    if (awaitingWithdrawalInputSet.has(userId.toString())) {
        return handleWithdrawalInput(ctx, textMessage);
    }

    return ctx.reply("❌ I didn't understand that. Try using the menu.");
}

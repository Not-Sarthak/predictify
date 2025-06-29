import type { Context } from "telegraf";

import {
    awaitingMarketTermInputSet,
    awaitingOrderDetailsInputSet,
    awaitingWalletDetailsInputSet,
} from "@/bot";
import { getUserIdFromCtx } from "@/bot/utils";
import { handleWalletDetailsTextMessage } from "@/bot/input/wallet-details";
import { handleMarketTermTextMessage } from "@/bot/input/market-term";
import { handleOrderDetailsTextMessage } from "@/bot/input/order-details";

export async function handleUserTextMessage(ctx: Context) {
    const textMessage = ctx.text?.trim();
    if (!textMessage) return;

    const userId = getUserIdFromCtx(ctx);

    // TODO:FIX - REFACTOR TEXT HANDLERS

    if (awaitingWalletDetailsInputSet.has(userId.toString())) {
        return handleWalletDetailsTextMessage(ctx, textMessage, userId);
    }

    if (awaitingMarketTermInputSet.has(userId.toString())) {
        return handleMarketTermTextMessage(ctx, textMessage, userId.toString());
    }

    if (awaitingOrderDetailsInputSet.has(userId.toString())) {
        return handleOrderDetailsTextMessage(ctx, textMessage, userId);
    }

    return ctx.reply("❌ I didn’t understand that. Try using the menu.");
}

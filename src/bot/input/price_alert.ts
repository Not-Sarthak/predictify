import type { Context } from "telegraf";

import { getUserIdFromCtx } from "@/bot/utils";
import { redisClient } from "@/lib/redis";
import { decodeMarketId } from "@/utils/encoding";
import { getMarketByConditionId } from "@/utils/polymarket/get-markets";
import { PolymarketMarketTradeWatcher } from "@/notifier/ws";
import { clearUserInputState } from "@/bot/input/state";

export async function handleSetMarketPriceAlert(ctx: Context, textMessage: string) {
    const userId = getUserIdFromCtx(ctx);
    const data = textMessage.split(/\s+/);

    if (data.length !== 3) {
        return ctx.reply(
            "❌ Invalid Input. Please Try again with the format: <code>0.7</code> <code>0.5</code> <code>No</code>",
            { parse_mode: "HTML" }
        );
    }

    const priceAbove = parseFloat(data[0]);
    const priceBelow = parseFloat(data[1]);
    const side = data[2].toLowerCase();

    if (isNaN(priceAbove) || isNaN(priceBelow) || (side !== "yes" && side !== "no")) {
        return ctx.reply(
            "❌ Invalid Input. Please Try again with the format: <code>0.7</code> <code>0.5</code> <code>No</code>",
            { parse_mode: "HTML" }
        );
    }

    if (priceAbove >= 1) {
        return ctx.reply("⚠️ 'Price-Above' must be less than 1.0", { parse_mode: "HTML" });
    }

    if (priceBelow <= 0) {
        return ctx.reply("⚠️ 'Price-Below' must be greater than 0.0", { parse_mode: "HTML" });
    }

    clearUserInputState(userId.toString());

    const orderContext = await redisClient.hGetAll(`user:order_context:${userId}`);

    const { marketId } = orderContext;
    const decodedMarketId = decodeMarketId(marketId);

    const market = await getMarketByConditionId(decodedMarketId);
    const clobTokenIds = JSON.parse(market.clobTokenIds);

    const assetId = side === "yes" ? clobTokenIds[0] : clobTokenIds[1];

    new PolymarketMarketTradeWatcher(userId.toString(), assetId, decodedMarketId, {
        type: "alert_above",
        price: priceAbove,
        outcome: "yes",
    });

    new PolymarketMarketTradeWatcher(userId.toString(), assetId, decodedMarketId, {
        type: "alert_below",
        price: priceBelow,
        outcome: "yes",
    });

    return ctx.reply(
        `🔔 <b>Price Alerts Set Successfully!</b>

<b>Market:</b> ${market.question}
<b>Side:</b> ${side.toUpperCase()}

<b>Alert if Price Above:</b> ${priceAbove}
<b>Alert if Price Below:</b> ${priceBelow}

You will receive a notification when the conditions are met.`,
        { parse_mode: "HTML" }
    );
}

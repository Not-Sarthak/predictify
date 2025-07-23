import { getUserIdFromCtx } from "@/bot/utils";
import { redisClient } from "@/lib/redis";
import { PolymarketMarketTradeWatcher } from "@/notifier/ws";
import type { Context } from "telegraf";

export async function handleTakeProfitOrStopLossExecution(ctx: Context, textMessage: string) {
    const userId = getUserIdFromCtx(ctx);
    const data = textMessage.split(/\s+/);

    if (data.length !== 1) {
        return ctx.reply("❌ Invalid Input. Please Try again with the format: <code>0.85</code>", {
            parse_mode: "HTML",
        });
    }

    const price = Number(data[0]);

    if (isNaN(price)) {
        return ctx.reply("❌ Invalid Input. Please Try again with the format: <code>0.7</code>", {
            parse_mode: "HTML",
        });
    }

    if (price >= 1) {
        return ctx.reply("⚠️ 'Price-Above' must be less than 1.0", { parse_mode: "HTML" });
    }

    if (price <= 0) {
        return ctx.reply("⚠️ 'Price-Below' must be greater than 0.0", { parse_mode: "HTML" });
    }

    const orderContext = await redisClient.hGetAll(`user:order_context:${userId}`);

    const { size, tokenId, action, marketId, outcome } = orderContext;

    new PolymarketMarketTradeWatcher(userId.toString(), tokenId, marketId, {
        type: action as "take_profit" | "stop_loss",
        price,
        size: Number(size),
        outcome,
    });

    await ctx.reply(
        `✅ <b>${action === "take_profit" ? "Take Profit" : "Stop Loss"} Set Successfully!</b>

<b>Side:</b> ${outcome?.toUpperCase()}
<b>Trigger Price:</b> <code>$${price.toFixed(4)}</code>
<b>Size:</b> <code>${Number(size).toFixed(4)} shares</code>

You'll be alerted and an order will be placed automatically once the price condition is met.`,
        { parse_mode: "HTML" }
    );
}

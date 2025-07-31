import { clearUserInputState } from "@/bot/input/state";
import { getUserIdFromCtx } from "@/bot/utils";
import { redisClient } from "@/lib/redis";
import { startTpSlWatcher, storeTpSlWatcherInRedis, type PriceWatchConfig } from "@/notifier/ws";
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

    if (price <= 0 || price >= 1) {
        return ctx.reply("⚠️ Price must be between 0.0 and 1.0", {
            parse_mode: "HTML",
        });
    }

    clearUserInputState(userId.toString());

    const orderContext = await redisClient.hGetAll(`user:order_context:${userId}`);

    const { size, tokenId, marketId, outcome } = orderContext;

    const config: PriceWatchConfig = {
        type: "tp_sl",
        price,
        size: Number(size),
        outcome,
    };

    await storeTpSlWatcherInRedis(userId.toString(), config, marketId, tokenId);
    startTpSlWatcher(userId.toString(), marketId, tokenId, config);

    await ctx.reply(
        `✅ <b>TP/SL Set Successfully!</b>

<b>Side:</b> ${outcome?.toUpperCase()}
<b>Trigger Price:</b> <code>$${price.toFixed(4)}</code>
<b>Size:</b> <code>${Number(size).toFixed(4)} shares</code>

You'll be alerted and an order will be placed automatically once the price condition is met.`,
        { parse_mode: "HTML" }
    );
}

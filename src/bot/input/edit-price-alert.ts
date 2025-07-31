import { clearUserInputState } from "@/bot/input/state";
import { getUserIdFromCtx } from "@/bot/utils";
import { redisClient } from "@/lib/redis";
import { getMarketQuestion } from "@/notifier/utils";
import {
    startPriceAlertWatcher,
    stopPriceAlertWatcher,
    storePriceAlertInRedis,
} from "@/notifier/ws";
import type { Context } from "telegraf";

export async function handleEditPriceAlert(ctx: Context, textMessage: string) {
    const userId = getUserIdFromCtx(ctx);
    const data = textMessage.split(" ");

    if (data.length !== 1) {
        return ctx.reply("❌ Invalid Input. Please Try again with the format: <code>0.85</code>", {
            parse_mode: "HTML",
        });
    }

    const price = Number(data);

    if (isNaN(price)) {
        return ctx.reply("❌ Invalid Input. Please Try again with the format: <code>0.7</code>", {
            parse_mode: "HTML",
        });
    }

    if (price <= 0 || price >= 1) {
        return ctx.reply("⚠️ Price must be between 0.0 and 1.0", { parse_mode: "HTML" });
    }

    clearUserInputState(userId.toString());

    const edits = await redisClient.hGetAll(`user:edit_price_alert:${userId}`);
    const shortKey = Object.keys(edits)[0];
    const oldConfigStr = edits[shortKey];

    if (!shortKey || !oldConfigStr) {
        await clearUserInputState(userId.toString());
        return ctx.reply("❌ No active alert edit session.");
    }

    const oldConfig = JSON.parse(oldConfigStr);
    const fullKey = await redisClient.hGet(`user:price_alert_keys:${userId}`, shortKey);
    if (!fullKey) {
        await clearUserInputState(userId.toString());
        return ctx.reply("❌ Original alert no longer exists.");
    }

    const newConfig = { ...oldConfig, price };

    // Delete old alert
    await redisClient.hDel(`user:price_alerts:${userId}`, fullKey);
    await redisClient.hDel(`user:price_alert_keys:${userId}`, shortKey);
    stopPriceAlertWatcher(userId.toString(), oldConfig.marketId);

    // Save new alert
    await storePriceAlertInRedis(
        userId.toString(),
        newConfig,
        oldConfig.marketId,
        oldConfig.assetId
    );
    startPriceAlertWatcher(userId.toString(), oldConfig.marketId, oldConfig.assetId, newConfig);

    const marketTitle = await getMarketQuestion(oldConfig.marketId);
    await ctx.reply(
        `✅ <b>Alert Updated</b>\n\n` +
            `<b>Market:</b> ${marketTitle}\n` +
            `<b>New Trigger Price:</b> ${price}\n` +
            `<b>Outcome:</b> ${newConfig.outcome.toUpperCase()}`,
        { parse_mode: "HTML" }
    );

    await redisClient.del(`user:edit_price_alert:${userId}`);
    await clearUserInputState(userId.toString());
}

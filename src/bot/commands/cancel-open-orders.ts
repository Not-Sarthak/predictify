import { Markup, type Context } from "telegraf";
import { getUserIdFromCtx } from "@/bot/utils";
import { getUnmatchedOpenOrders } from "@/utils/polymarket/get-non-matched-orders";
import { encodeMarketId } from "@/utils/encoding";
import { redisClient } from "@/lib/redis";

export async function handleCancelOpenOrdersCommand(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);
    const trackedOrderIds = await redisClient.lRange(`user:order_ids:${userId}`, 0, -1);

    if (!trackedOrderIds || trackedOrderIds.length === 0) {
        return ctx.reply("✅ No unmatched open orders found.");
    }

    const unmatchedOrders = await getUnmatchedOpenOrders(userId, trackedOrderIds);

    if (!Array.isArray(unmatchedOrders) && !unmatchedOrders) {
        return ctx.reply("❌ Internal Server Error");
    }

    if (unmatchedOrders.length === 0) {
        return ctx.reply("✅ No unmatched open orders found.");
    }

    for (const order of unmatchedOrders) {
        const createdDate = new Date(order.created_at);
        const createdDateStr = isNaN(createdDate.getTime())
            ? "N/A"
            : createdDate.toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
              });

        const text = `
🧾 *Open Order*
📊 *Market:* ${order.market}
📈 *Side:* ${order.side}
💰 *Price:* $${parseFloat(order.price).toFixed(4)}
📦 *Size:* ${parseFloat(order.original_size).toFixed(2)}
🎯 *Outcome:* ${order.outcome}
⏱ *Created:* ${createdDateStr}
        `.trim();

        const inlineKeyboard = Markup.inlineKeyboard([
            Markup.button.callback("❌ Cancel Order", `cancel_order:${encodeMarketId(order.id)}`),
        ]);

        await ctx.reply(text, {
            parse_mode: "Markdown",
            reply_markup: inlineKeyboard.reply_markup,
        });
    }
}

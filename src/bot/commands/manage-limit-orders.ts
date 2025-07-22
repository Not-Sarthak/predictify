import { Markup, type Context } from "telegraf";
import { getUserIdFromCtx } from "@/bot/utils";
import { getUnmatchedOpenOrders } from "@/utils/polymarket/get-non-matched-orders";
import { encodeMarketId } from "@/utils/encoding";
import { redisClient } from "@/lib/redis";
import { CLOSE_BUTTON } from "@/bot/ui/buttons";
import { getMarketByConditionId } from "@/utils/polymarket/get-markets";

export async function handleCancelOpenOrdersCommand(ctx: Context) {
    const msg = await ctx.reply("⌛ Fetching your Open Limit Orders...");

    const userId = getUserIdFromCtx(ctx);
    const trackedOrderIds = await redisClient.lRange(`user:order_ids:${userId}`, 0, -1);

    await ctx.deleteMessage(msg.message_id);

    if (!trackedOrderIds || trackedOrderIds.length === 0) {
        return ctx.reply("✅ No unmatched open orders found.");
    }

    const unmatchedOrders = await getUnmatchedOpenOrders(userId, trackedOrderIds);

    if (!unmatchedOrders || unmatchedOrders.length === 0) {
        return ctx.reply("✅ No unmatched open orders found.");
    }

    return sendPaginatedOrder(ctx, unmatchedOrders, 0);
}

export async function sendPaginatedOrder(ctx: Context, orders: any[], offset: number) {
    const order = orders[offset];

    const market = await getMarketByConditionId(order.market);
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
📊 *Market:* ${market?.question}
📈 *Side:* ${order.side}
💰 *Price:* $${parseFloat(order.price).toFixed(4)}
📦 *Size:* ${parseFloat(order.original_size).toFixed(2)}
🎯 *Outcome:* ${order.outcome}
⏱ *Created:* ${createdDateStr}
    `.trim();

    const encodedOrderId = encodeMarketId(order.id);
    const navButtons = [];

    if (offset > 0) {
        navButtons.push(Markup.button.callback("⬅️ Prev", `orders:prev:${offset - 1}`));
    }

    if (offset + 1 < orders.length) {
        navButtons.push(Markup.button.callback("➡️ Next", `orders:next:${offset + 1}`));
    }

    const actionButtons = [
        Markup.button.callback("✏️ Edit Order", `edit_order:${encodedOrderId}`),
        Markup.button.callback("❌ Cancel Order", `cancel_order:${encodedOrderId}`),
    ];

    const bottomButtons = [
        Markup.button.callback("🔄 Refresh", `refresh_order:${offset}`),
        CLOSE_BUTTON,
    ];

    const keyboard = Markup.inlineKeyboard([
        actionButtons,
        navButtons.filter(Boolean),
        bottomButtons,
    ]);

    const isPaginatedNavigation =
        ctx.callbackQuery || (ctx.callbackQuery as any)?.data?.startsWith("orders:");

    if (isPaginatedNavigation) {
        try {
            await ctx.editMessageText(text, {
                parse_mode: "Markdown",
                reply_markup: keyboard.reply_markup,
            });
        } catch (error: any) {
            if (
                error?.response?.error_code === 400 &&
                error?.response?.description?.includes("message is not modified")
            ) {
                await ctx.answerCbQuery();
            } else {
                console.error("❌ editMessageText Failed:", error);
                await ctx.answerCbQuery("⚠️ Failed to Update the Message.");
            }
        }
    } else {
        return ctx.reply(text, {
            parse_mode: "Markdown",
            reply_markup: keyboard.reply_markup,
        });
    }
}

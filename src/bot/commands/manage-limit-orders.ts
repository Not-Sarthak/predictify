import { Markup, type Context } from "telegraf";
import { getUserIdFromCtx } from "../utils";
import { getUnmatchedOpenOrders } from "../../utils/polymarket/get-non-matched-orders";
import { encodeMarketConditionId } from "../../utils/encoding";
import { redisClient } from "../../lib/redis";
import { CLOSE_BUTTON } from "../ui/buttons";
import { getMarketByConditionId } from "../../utils/polymarket/get-markets";
import { getUserLanguage } from "../../helpers/user-language";
import { getMessages } from "../../i18n";

export async function handleShowManageOrdersMainMenu(ctx: Context) {
    return ctx.reply("⚙️ Manage your orders", {
        reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback("View Open Orders", "view_cancel_order_menu")],
            [Markup.button.callback("View TP/SL Orders", "view_tp_sl_order_menu")],
        ]).reply_markup,
    });
}

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
    const outcomePrices = JSON.parse(market.outcomePrices);

    const text = `
🧾 *Open Order*
📊 *Market:* ${market?.question}
📈 *Side:* ${order.side}
💰 *Price:* $${parseFloat(order.price).toFixed(4)}
💰 *Current Price:* $${parseFloat(order.outcome === "Yes" ? outcomePrices[0] : outcomePrices[1]).toFixed(4)}
📦 *Size:* ${parseFloat(order.original_size).toFixed(2)}
🎯 *Outcome:* ${order.outcome}
    `.trim();

    const encodedOrderId = encodeMarketConditionId(order.id);
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

    const userId = getUserIdFromCtx(ctx);
    const language = await await getUserLanguage(userId);
    const messages = getMessages(language as any);

    const bottomButtons = [
        Markup.button.callback(messages.refresh, `refresh_order:${offset}`),
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

export async function handleShowOpenTpSlOrders(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);
    const keys = await redisClient.keys(`user:tp_sl_watchers:${userId}*`);
    const tpSlOrders: any[] = [];

    for (const key of keys) {
        const entries = await redisClient.hGetAll(key);
        for (const configStr of Object.values(entries)) {
            const config = JSON.parse(configStr);
            tpSlOrders.push(config);
        }
    }

    if (tpSlOrders.length === 0) {
        return ctx.reply("✅ You have no active Take Profit / Stop Loss orders.");
    }

    return sendPaginatedTpSlOrder(ctx, tpSlOrders, 0);
}

export async function sendPaginatedTpSlOrder(ctx: Context, orders: any[], offset: number) {
    const order = orders[offset];
    const market = await getMarketByConditionId(order.marketId);
    const outcomePrices = JSON.parse(market.outcomePrices);
    const currentPrice = parseFloat(order.outcome === "Yes" ? outcomePrices[0] : outcomePrices[1]);

    const priceDiff = order.price - currentPrice;
    const percentDiff = (priceDiff / order.price) * 100;

    const isOrderTp = order.type === "take_profit";

    const text = `
🎯 *${isOrderTp ? "Take Profit" : "Stop Loss"} Order*

*${market.question}*

*Trigger Price:* $${order.price.toFixed(4)}
*Current Price:* $${currentPrice.toFixed(4)}
*Change:* ${priceDiff >= 0 ? "+" : ""}${percentDiff.toFixed(2)}%
*Size:* ${order.size}%
*Outcome:* ${order.outcome}
    `.trim();

    const navButtons = [];
    if (offset > 0) navButtons.push(Markup.button.callback("⬅️ Prev", `tp_sl:prev:${offset - 1}`));
    if (offset + 1 < orders.length)
        navButtons.push(Markup.button.callback("➡️ Next", `tp_sl:next:${offset + 1}`));

    const cancelBtnData = isOrderTp
        ? `stop_tp:${encodeMarketConditionId(order.marketId)}`
        : `stop_sl:${encodeMarketConditionId(order.marketId)}`;
    const userId2 = getUserIdFromCtx(ctx);
    const language2 = await getUserLanguage(userId2);
    const messages2 = await getMessages(language2 as any);
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("❌ Cancel", cancelBtnData)],
        navButtons,
        [Markup.button.callback(messages2.refresh, `tp_sl:refresh:${offset}`), CLOSE_BUTTON],
    ]);

    const isPaginatedNavigation = (ctx.callbackQuery as any)?.data?.startsWith("tp_sl:");

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

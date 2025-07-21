import { getUserIdFromCtx } from "@/bot/utils";
import { getUserDetails } from "@/helpers/get-user-details";
import { getUserHistory } from "@/utils/polymarket/get-user-history";
import { Markup, type Context } from "telegraf";

const PAGE_SIZE = 10;

export async function handleUserTradeHistoryCommand(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);
    const user = await getUserDetails(userId);

    if (!user) {
        return ctx.reply("❌ User does not exist.");
    }

    return sendPaginatedHistory(ctx, user.wallet_address, 0);
}

export async function sendPaginatedHistory(ctx: Context, walletAddress: string, offset: number) {
    const isFromCallback = !!ctx.callbackQuery;
    let msg;

    if (!isFromCallback) {
        msg = await ctx.reply("⌛ Fetching your Trade History...");
    }

    try {
        const history = await getUserHistory(walletAddress, offset, PAGE_SIZE);

        if (msg) {
            await ctx.deleteMessage(msg.message_id);
        }

        if (!history || history.length === 0) {
            const fallbackMsg = offset === 0 ? "📭 No trades found." : "❌ No more trades.";
            return isFromCallback
                ? ctx.editMessageText(fallbackMsg).catch(() => ctx.reply(fallbackMsg))
                : ctx.reply(fallbackMsg);
        }

        const formattedTrades = history.map((trade) => {
            const side = trade.side === "BUY" ? "🟢 BOUGHT" : "🔴 SOLD";
            const title = trade.title.length > 50 ? trade.title.slice(0, 47) + "…" : trade.title;
            const amount = Number(trade.size).toFixed(2);
            const price = Number(trade.price).toFixed(2);
            const link = `https://polymarket.com/market/${trade.slug}`;

            return `${side} ${amount} shares @ $${price}\n📊 ${title}\n🔗 [View on Polymarket](${link})`;
        });

        const message =
            `🧾 *Your Trades (${offset + 1}-${offset + formattedTrades.length})*\n\n` +
            formattedTrades.join("\n\n");

        const navButtons = [];

        if (offset > 0) {
            navButtons.push(
                Markup.button.callback("⬅️ Prev", `history:${offset - PAGE_SIZE}:${walletAddress}`)
            );
        }
        if (history.length === PAGE_SIZE) {
            navButtons.push(
                Markup.button.callback("➡️ Next", `history:${offset + PAGE_SIZE}:${walletAddress}`)
            );
        }

        const options = {
            parse_mode: "Markdown" as const,
            link_preview_options: { is_disabled: true },
            reply_markup: Markup.inlineKeyboard(navButtons).reply_markup,
        };

        return isFromCallback
            ? ctx.editMessageText(message, options).catch(() => ctx.reply(message, options))
            : ctx.reply(message, options);
    } catch (err) {
        console.error("Error fetching trade history:", err);
        const fallbackMsg = "❌ Failed to fetch trade history.";
        return isFromCallback
            ? ctx.editMessageText(fallbackMsg).catch(() => ctx.reply(fallbackMsg))
            : ctx.reply(fallbackMsg);
    }
}

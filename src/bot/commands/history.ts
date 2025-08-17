import { getUserIdFromCtx } from "../utils";
import { getUserDetails } from "../../helpers/get-user-details";
import { getMarketByConditionId } from "../../utils/polymarket/get-markets";
import { getUserHistory } from "../../utils/polymarket/get-user-history";
import { Markup, type Context } from "telegraf";
import { CLOSE_BUTTON } from "../ui/buttons";

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
        const uniqueConditionIds = [...new Set(history.map((t) => t.conditionId))];

        if (msg) {
            await ctx.deleteMessage(msg.message_id);
        }

        if (!history || history.length === 0) {
            const fallbackMsg = offset === 0 ? "📭 No trades found." : "❌ No more trades.";
            return isFromCallback
                ? ctx.editMessageText(fallbackMsg).catch(() => ctx.reply(fallbackMsg))
                : ctx.reply(fallbackMsg);
        }

        const marketMap = new Map<string, any>();
        await Promise.all(
            uniqueConditionIds.map(async (conditionId) => {
                const market = await getMarketByConditionId(conditionId);
                marketMap.set(conditionId, market);
            })
        );

        // Step 3: Format each trade using cached market data
        const formattedTrades = history.map((trade, idx) => {
            const sideEmoji = trade.side === "BUY" ? "🟢" : "🔴";
            const title = trade.title.length > 50 ? trade.title.slice(0, 47) + "…" : trade.title;

            const size = Number(trade.size);
            const entryPrice = Number(trade.price);
            const market = marketMap.get(trade.conditionId);
            const curPrice = Number(JSON.parse(market.outcomePrices)[trade.outcomeIndex]);

            const invested = size * entryPrice;
            const cashout = size * curPrice;
            const pnl = cashout - invested;
            const pnlPct = (pnl / invested) * 100;

            const investedStr = `$${invested.toFixed(2)}`;
            const cashoutStr = `$${cashout.toFixed(2)}`;
            const pnlStr = `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`;
            const pnlPctStr = `${pnl >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%`;

            const polyMarketLink = `https://polymarket.com/market/${trade.slug}`;
            const polygonScanLink = `https://polygonscan.com/tx/${trade.transactionHash}`;

            return `*#${offset + idx + 1} - ${sideEmoji} ${title}*

Entry: $${entryPrice.toFixed(4)} • Shares: ${size.toFixed(2)}
💸 Invested: ${investedStr} • Cashout: ${cashoutStr}
📉 P&L: ${pnlStr} (${pnlPctStr})

[Polymarket](${polyMarketLink}) • [Polygonscan](${polygonScanLink})
---------------------------------------`;
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

        navButtons.push(CLOSE_BUTTON);

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

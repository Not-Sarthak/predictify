import { getUserIdFromCtx } from "@/bot/utils";
import { getUserDetails } from "@/helpers/get-user-details";
import { getUserHistory } from "@/utils/polymarket/get-user-history";
import type { Context } from "telegraf";

export async function handleUserTradeHistoryCommand(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);
    const user = await getUserDetails(userId);

    if (!user) {
        return ctx.reply("❌ User does not exist");
    }

    try {
        const history = await getUserHistory(user.wallet_address);

        if (!history || history.length === 0) {
            return ctx.reply("📭 No trades found for your account.");
        }

        const formatted = history
            .map((trade) => {
                const side = trade.side === "BUY" ? "🟢 BUY" : "🔴 SELL";
                const title =
                    trade.title.length > 50 ? trade.title.slice(0, 47) + "…" : trade.title;
                const amount = Number(trade.size).toFixed(2);
                const price = Number(trade.price).toFixed(2);
                const link = `https://polymarket.com/market/${trade.slug}`;

                return `${side} ${amount} shares @ $${price}\n📊 ${title}\n🔗 [View on Polymarket](${link})`;
            })
            .join("\n\n");

        return ctx.reply(`🧾 *Your Recent Trades*\n\n${formatted}`, {
            parse_mode: "Markdown",
            link_preview_options: { is_disabled: true },
        });
    } catch (err) {
        console.error("Error fetching trade history:", err);
        return ctx.reply("❌ Failed to fetch trade history.");
    }
}

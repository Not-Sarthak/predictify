import type { Context } from "telegraf";
import { getUserIdFromCtx } from "../utils";
import { ADMIN_USERS_ID } from "../../shared/constants/misc";
import { db } from "../../lib/supabase";

const formatNumber = (num: number | null | undefined, fractionDigits = 2) => {
    if (num == null) return "0";
    return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: fractionDigits,
    }).format(num);
};

export async function handleBotStatistics(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);
    if (!ADMIN_USERS_ID.includes(userId)) return;

    const {
        data: users,
        error,
        count,
    } = await db("Users").select("total_volume, markets_traded, txns_executed", { count: "exact" });

    if (error || !users) {
        console.error(error);
        return ctx.reply("❌ Failed to fetch statistics.");
    }

    const totalUsers = count || 0;
    const totalVolume = users.reduce((sum, u) => sum + (u.total_volume ?? 0), 0);
    const totalMarketsTraded = users.reduce((sum, u) => sum + (u.markets_traded ?? 0), 0);
    const totalTxsExecuted = users.reduce((sum, u) => sum + (u.txns_executed ?? 0), 0);

    const message = `
📊 *Bot Statistics*

👥 Total Users: ${formatNumber(totalUsers, 0)}
💰 Total Volume: $${formatNumber(totalVolume)}
📈 Total Markets Traded: ${formatNumber(totalMarketsTraded, 0)}
📝 Total TXs Executed: ${formatNumber(totalTxsExecuted, 0)}
  `;

    await ctx.reply(message, { parse_mode: "Markdown" });
}

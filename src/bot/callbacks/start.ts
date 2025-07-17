import { Markup, type Context } from "telegraf";

import { handleAutoTradeMenu } from "@/bot/ui/messages";
import { handleSettingsMenu } from "@/bot/callbacks/settings";
import { handleSubscriptionsMenu } from "@/bot/callbacks/subscriptions";
import { handleTradeMenu } from "@/bot/callbacks/trade";
import { getUserByIdFromDb, getUserIdFromCtx } from "@/bot/utils";
import { getUserPositionsFromPolymarket } from "@/bot/utils/get-user-positions";
import { CLOSE_BUTTON } from "@/bot/ui/buttons";
import { getUserTotalHoldings, getUserTotalPnL } from "@/bot/utils/get-user-polymarket-data";

export async function handleStartMenuCallbacks(ctx: Context, target: string) {
    switch (target) {
        case "subscriptions":
            return handleSubscriptionsMenu(ctx);
        case "trade":
            return handleTradeMenu(ctx);
        case "autotrade":
            return handleAutoTradeMenu(ctx);
        case "settings":
            return handleSettingsMenu(ctx);
        default:
            return ctx.answerCbQuery();
    }
}

export async function handleViewProfileCallback(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);

    const { data: userData, error: userDataError } = await getUserByIdFromDb(userId);

    if (userDataError) {
        return ctx.reply("❌ Error fetching User Data");
    }

    if (!userData) {
        return ctx.reply("❌ User does not exist");
    }

    const { wallet_address, referral_code, number_of_referrals } = userData;

    const [total_holdings, total_pnl, positions] = await Promise.all([
        getUserTotalHoldings(wallet_address),
        getUserTotalPnL(wallet_address),
        getUserPositionsFromPolymarket(wallet_address),
    ]);

    let positionsWon = 0;
    if (positions && Array.isArray(positions)) {
        for (const position of positions) {
            if (position.cashPnl > 0) positionsWon += 1;
        }
    }

    const winRate = positions && positions.length > 0 ? (positionsWon / positions.length) * 100 : 0;
    const emoji = total_pnl > 0 ? "📈" : "📉";
    const message = `
<b>👤 Your Polymarket Profile</b>

${emoji} <b>Lifetime PnL:</b> ${total_pnl.toFixed(3)} USDC
💵 <b>Total Holdings:</b> ${total_holdings.toFixed(3)} USDC
🔥 <b>Win Rate:</b> ${winRate.toFixed(1)}%

🎟️ <b>Your Referral Code:</b> <code>${referral_code || "Not assigned"}</code>
👥 <b>Referrals:</b> ${number_of_referrals || 0} users

<a href="https://polymarket.com/profile/${wallet_address.toString()}">🔗 View on Polymarket</a>
`;

    return ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: Markup.inlineKeyboard([CLOSE_BUTTON]).reply_markup,
    });
}

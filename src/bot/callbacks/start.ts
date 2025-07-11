import { Markup, type Context } from "telegraf";

import { handleAutoTradeMenu } from "@/bot/callbacks/autotrade";
import { handleSettingsMenu } from "@/bot/callbacks/settings";
import { handleSubscriptionsMenu } from "@/bot/callbacks/subscriptions";
import { handleTradeMenu } from "@/bot/callbacks/trade";
import { getUserByIdFromDb, getUserIdFromCtx } from "@/bot/utils";
import { getUserPositionsFromPolymarket } from "@/bot/utils/get-user-positions";
import { CLOSE_BUTTON } from "@/bot/ui/buttons";

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

    const { wallet_address, total_pnl, total_volume } = userData;
    const emoji = total_pnl > 0 ? "📈" : "📉";

    const positions = await getUserPositionsFromPolymarket(wallet_address);

    let positionsWon = 0;
    for (const position of positions) {
        if (position.cashPnl > 0) positionsWon += 1;
    }

    const winRate = (positionsWon / positions.length) * 100;

    const message = `
<b>👤 Your Polymarket Profile</b>

${emoji} <b>Lifetime PnL:</b> ${total_pnl.toFixed(3)} USDC
💵 <b>Total Volume:</b> ${total_volume} USDC
🔥 <b>Win Rate:</b> ${winRate.toFixed(1)}%

<a href="https://polymarket.com/profile/${wallet_address.toString()}">🔗 View on Polymarket</a>
`;

    return ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: Markup.inlineKeyboard([CLOSE_BUTTON]).reply_markup,
    });
}

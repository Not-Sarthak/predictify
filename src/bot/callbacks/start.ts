import { Markup, type Context } from "telegraf";

import { handleAutoTradeMenu } from "../ui/messages";
import { handleSettingsMenu } from "../callbacks/settings";
import { handleSubscriptionsMenu } from "../callbacks/subscriptions";
import { handleTradeMenu } from "../callbacks/trade";
import { handleStrategiesMenu } from "../callbacks/strategies";
import { getUserByIdFromDb, getUserIdFromCtx } from "../utils";
import { getUserPositionsFromPolymarket } from "../utils/get-user-positions";
import { generateTranslatedViewProfileButtons } from "../ui/buttons/translated";
import { getUserTotalHoldings, getUserTotalPnL } from "../utils/get-user-polymarket-data";
import { getUserLanguage } from "../../helpers/user-language";
import { t } from "../../i18n";

export async function handleStartMenuCallbacks(ctx: Context, target: string) {
    switch (target) {
        case "subscriptions":
            return handleSubscriptionsMenu(ctx);
        case "trade":
            return handleTradeMenu(ctx);
        case "strategies":
            return handleStrategiesMenu(ctx);
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
    const language = await getUserLanguage(userId);

    const { message_id } = await ctx.reply("⚡ Fetching your profile...");

    const { data: userData, error: userDataError } = await getUserByIdFromDb(userId);

    await ctx.deleteMessage(message_id);

    if (!userData) {
        return ctx.reply("❌ User does not exist");
    }

    if (userDataError) {
        return ctx.reply("❌ Error fetching User Data");
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
<b>👤 ${await t("yourPolymarketProfile", language)}</b>

${emoji} <b>${await t("lifetimePnl", language)}</b> ${total_pnl.toFixed(3)} USDC
💵 <b>${await t("totalHoldings", language)}</b> ${total_holdings.toFixed(3)} USDC
🔥 <b>${await t("winRate", language)}</b> ${winRate.toFixed(1)}%

🎟️ <b>${await t("yourReferralCode", language)}</b> <code>${referral_code || (await t("notAssigned", language))}</code>
👥 <b>${await t("referrals", language)}</b> ${number_of_referrals || 0} users

<a href="https://polymarket.com/profile/${wallet_address.toString()}">${await t("viewOnPolymarket", language)}</a>
`;

    const translatedButtons = await generateTranslatedViewProfileButtons(
        userId,
        userData.show_username_in_cards
    );

    return ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: Markup.inlineKeyboard(translatedButtons).reply_markup,
    });
}

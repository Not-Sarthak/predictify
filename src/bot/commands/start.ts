import { Markup, type Context } from "telegraf";

import { getUserIdFromCtx } from "@/bot/utils";
import { getUserByIdFromDb } from "@/bot/utils/database/get-user-db";
import { getSOLBalance, getUserWrappedUSDCBalance } from "@/helpers/get-user-balance";
import { generateWelcomeMessage } from "@/bot/ui/messages";
import { MAIN_MENU_BUTTONS } from "@/bot/ui/buttons";
import { setUserInputState } from "@/bot/input/state";

export async function handleStartCommand(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);

    const { data: existingUser, error: dbError } = await getUserByIdFromDb(userId);
    if (dbError) {
        return ctx.reply("❌ Something Went Wrong. Please Try Again Later.");
    }

    if (existingUser) {
        const balance = await getUserWrappedUSDCBalance(existingUser.wallet_address);
        const solBalance = existingUser.solana_address
            ? await getSOLBalance(existingUser.solana_address)
            : 0;
        const message = generateWelcomeMessage(
            existingUser.wallet_address,
            existingUser.solana_address || "N/A",
            balance.toString(),
            solBalance
        );
        const keyboard = Markup.inlineKeyboard(MAIN_MENU_BUTTONS);

        return ctx.reply(message, {
            parse_mode: "HTML",
            reply_markup: keyboard.reply_markup,
        });
    }

    // For new users, ask for referral code
    await setUserInputState(userId.toString(), "referral");

    return ctx.reply(
        "👋 Welcome to PolyMarket Trading Bot!\n\n" +
            "To get started, please enter a valid invite code.",
        { parse_mode: "HTML" }
    );
}

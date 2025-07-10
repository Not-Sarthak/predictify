import { Markup, type Context } from "telegraf";

import { getUserIdFromCtx, insertUserInDb } from "@/bot/utils";
import { getUsernameFromCtx } from "@/bot/utils";
import { getUserByIdFromDb } from "@/bot/utils/database/get-user-db";
import { getSOLBalance, getUserWrappedUSDCBalance } from "@/helpers/get-user-balance";
import { generateWelcomeMessage } from "@/bot/ui/messages";
import { MAIN_MENU_BUTTONS } from "@/bot/ui/buttons";
import { generateAPIKeyAndWallet } from "@/utils/polymarket/generate-user";
import { CHAIN_ID, HOST } from "@/shared/constants";
import { awaitingReferralCodeInputSet } from "@/bot";

export async function handleStartCommand(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);
    const userName = getUsernameFromCtx(ctx);

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

    // For new users, first create a basic record
    const { success, error: insertError } = await insertUserInDb(
        userId,
        userName,
        "", // Empty wallet address for now
        "", // Empty private key for now
        "", // Empty API creds for now
        "", // Empty solana address for now
        "" // Empty solana private key for now
    );

    if (!insertError) {
        console.error(insertError);
        return ctx.reply("❌ There Was an Error Creating Your Account.");
    }

    // Add user to awaiting referral code set
    awaitingReferralCodeInputSet.add(userId.toString());

    return ctx.reply(
        "👋 Welcome to PolyMarket Trading Bot!\n\n" +
            "To get started, please enter a valid referral code. " +
            "If you don't have one, please contact the bot administrator.",
        { parse_mode: "HTML" }
    );
}

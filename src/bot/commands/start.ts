import { Markup, type Context } from "telegraf";

import { getUserIdFromCtx, getUsernameFromCtx } from "../utils";
import { getUserByIdFromDb } from "../utils/database/get-user-db";
import { getSOLBalance, getUserWrappedUSDCBalance } from "../../helpers/get-user-balance";
import { generateWelcomeMessage } from "../ui/messages";
import { MAIN_MENU_BUTTONS } from "../ui/buttons";
import { setUserInputState } from "../input/state";
import { generateAPIKeyAndWallet } from "../../utils/polymarket/generate-user";
import { CHAIN_ID, HOST } from "../../shared/constants";
import { encryptPrivateKey } from "../../utils/crypto";
import { db } from "../../lib/supabase";
import { generateRandomString } from "../../utils/encoding";
import { getUserDetails } from "../../helpers/get-user-details";
import { getLockedBalance } from "../../utils/polymarket/get-locked-balance";

export async function handleStartCommand(ctx: Context) {
    console.log("[START] Command received from user:", ctx.from?.id, ctx.from?.username);
    const userId = getUserIdFromCtx(ctx);
    console.log("[START] Processing for user ID:", userId);

    const { data: existingUser, error: dbError } = await getUserByIdFromDb(userId);
    if (dbError) {
        console.error(`[START] Database error for user ${userId}:`, dbError);
        return ctx.reply("❌ Something Went Wrong. Please Try Again Later.");
    }

    if (existingUser) {
        const [balance, user, solBalance, lockedBalance] = await Promise.all([
            getUserWrappedUSDCBalance(existingUser.wallet_address),
            getUserDetails(userId),
            getSOLBalance(existingUser.solana_address!),
            getLockedBalance(userId),
        ]);

        if (!user) {
            return ctx.reply("❌ Internal Server Error");
        }

        const message = generateWelcomeMessage(
            existingUser.wallet_address,
            existingUser.solana_address || "N/A",
            balance.toString(),
            solBalance,
            lockedBalance
        );
        const keyboard = Markup.inlineKeyboard(MAIN_MENU_BUTTONS);

        return ctx.reply(message, {
            parse_mode: "HTML",
            reply_markup: keyboard.reply_markup,
        });
    }

    // For new users, ask for referral code
    // TEMPORARILY DISABLED - Bot is open for everyone
    // await setUserInputState(userId.toString(), "referral");

    // return ctx.reply(
    //     "👋 Welcome to PolyMarket Trading Bot!\n\n" +
    //         "To get started, please enter a valid invite code.",
    //     { parse_mode: "HTML" }
    // );

    // Instead, create new user directly without invite code
    try {
        const { address, privateKey, apiCreds, solanaAddress, solanaPrivateKey } =
            await generateAPIKeyAndWallet({
                host: HOST,
                chainId: CHAIN_ID,
            });

        const newUserReferralCode = generateRandomString(6);
        const userName = getUsernameFromCtx(ctx);

        const { error: insertError } = await db("Users").insert([
            {
                id: userId,
                telegram_username: userName,
                wallet_address: address,
                private_key: encryptPrivateKey(privateKey),
                api_credentials: JSON.stringify(apiCreds),
                solana_address: solanaAddress,
                solana_private_key: encryptPrivateKey(solanaPrivateKey),
                referred_code: "OPEN", // Default value for open registration
                referral_code: newUserReferralCode,
                treasury_wallet_address: address,
            },
        ]);

        if (insertError) {
            console.error(`[START] Error creating user ${userId}:`, insertError);
            return ctx.reply("❌ Error creating your account. Please try again later.");
        }

        const [balance, user, solBalance, lockedBalance] = await Promise.all([
            getUserWrappedUSDCBalance(address),
            getUserDetails(userId),
            getSOLBalance(solanaAddress),
            getLockedBalance(userId),
        ]);

        if (!user) {
            return ctx.reply("❌ Internal Server Error");
        }

        const message = generateWelcomeMessage(
            address,
            solanaAddress || "N/A",
            balance.toString(),
            solBalance,
            lockedBalance
        );
        const keyboard = Markup.inlineKeyboard(MAIN_MENU_BUTTONS);

        return ctx.reply(message, {
            parse_mode: "HTML",
            reply_markup: keyboard.reply_markup,
        });
    } catch (error) {
        console.error(`[START] Unexpected error for user ${userId}:`, error);
        return ctx.reply("❌ An unexpected error occurred. Please try again later.");
    }
}

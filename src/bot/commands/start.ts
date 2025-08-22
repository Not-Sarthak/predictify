import { Markup, type Context } from "telegraf";

import { getUserIdFromCtx, getUsernameFromCtx } from "../utils";
import { getUserByIdFromDb } from "../utils/database/get-user-db";
import { getSOLBalance, getUserWrappedUSDCBalance } from "../../helpers/get-user-balance";
import { generateWelcomeMessage } from "../ui/messages";
import { generateTranslatedMainMenuButtons } from "../ui/buttons/translated";
import { generateAPIKeyAndWallet } from "../../utils/polymarket/generate-user";
import { CHAIN_ID, HOST } from "../../shared/constants";
import { encryptPrivateKey } from "../../utils/crypto";
import { db } from "../../lib/supabase";
import { generateRandomString } from "../../utils/encoding";
import { getUserDetails } from "../../helpers/get-user-details";
import { getLockedBalance } from "../../utils/polymarket/get-locked-balance";
import { trackReferralRelationship } from "../../utils/referral/referral-tracker";

export async function handleStartCommand(ctx: Context) {
    const iMsg1 = await ctx.reply("⚡ Looking for your profile...");

    const userId = getUserIdFromCtx(ctx);
    const referrerUsername =
        ctx.message && "text" in ctx.message ? ctx.message.text.split(" ")[1] : undefined;

    const { data: existingUser, error: dbError } = await getUserByIdFromDb(userId);
    await ctx.deleteMessage(iMsg1.message_id);

    if (dbError) {
        console.error(`[START] Database error for user ${userId}:`, dbError);
        return ctx.reply("❌ Something Went Wrong. Please Try Again Later.");
    }

    if (existingUser) {
        const iMsg2 = await ctx.reply("⚡ Fetching your profile data...");

        const [balance, user, solBalance, lockedBalance] = await Promise.all([
            getUserWrappedUSDCBalance(existingUser.wallet_address),
            getUserDetails(userId),
            getSOLBalance(existingUser.solana_address!),
            getLockedBalance(userId),
        ]);

        await ctx.deleteMessage(iMsg2.message_id);

        if (!user) {
            return ctx.reply("❌ Internal Server Error");
        }

        const message = await generateWelcomeMessage(
            existingUser.wallet_address,
            existingUser.solana_address || "N/A",
            balance.toString(),
            solBalance,
            lockedBalance,
            userId
        );
        const translatedButtons = await generateTranslatedMainMenuButtons(userId);
        const keyboard = Markup.inlineKeyboard(translatedButtons);

        return ctx.reply(message, {
            parse_mode: "HTML",
            reply_markup: keyboard.reply_markup,
        });
    }

    const iMsg3 = await ctx.reply("⚡ Creating your account...");

    // Create new user
    try {
        const { address, privateKey, apiCreds, solanaAddress, solanaPrivateKey } =
            await generateAPIKeyAndWallet({
                host: HOST,
                chainId: CHAIN_ID,
            });

        const newUserReferralCode = generateRandomString(6);
        const userName = getUsernameFromCtx(ctx);

        // Determine referral relationship
        let referredCode = "OPEN"; // Default for open registration

        if (referrerUsername) {
            // Track referral relationship
            const result = await trackReferralRelationship(userId, referrerUsername);
            if (result.success) {
                referredCode = referrerUsername;
                console.log(`✅ New user ${userId} referred by ${referrerUsername}`);
            } else {
                console.log(`⚠️ Referral tracking failed: ${result.error}`);
            }
        }

        const { error: insertError } = await db("Users").insert([
            {
                id: userId,
                telegram_username: userName,
                wallet_address: address,
                private_key: encryptPrivateKey(privateKey),
                api_credentials: JSON.stringify(apiCreds),
                solana_address: solanaAddress,
                solana_private_key: encryptPrivateKey(solanaPrivateKey),
                referred_code: referredCode,
                referral_code: newUserReferralCode,
                treasury_wallet_address: address,
            },
        ]);

        await ctx.deleteMessage(iMsg3.message_id);

        if (insertError) {
            console.error(`[START] Error creating user ${userId}:`, insertError);
            return ctx.reply("❌ Error creating your account. Please try again later.");
        }

        const iMsg4 = await ctx.reply("⚡ Fetching your profile data...");

        const [balance, user, solBalance, lockedBalance] = await Promise.all([
            getUserWrappedUSDCBalance(address),
            getUserDetails(userId),
            getSOLBalance(solanaAddress),
            getLockedBalance(userId),
        ]);

        await ctx.deleteMessage(iMsg4.message_id);

        if (!user) {
            return ctx.reply("❌ Internal Server Error");
        }

        let message = await generateWelcomeMessage(
            address,
            solanaAddress || "N/A",
            balance.toString(),
            solBalance,
            lockedBalance,
            userId
        );

        // Add referral success message if applicable
        if (referredCode !== "OPEN") {
            message += `\n\n🎉 **Welcome!** You've been referred by @${referrerUsername}!\n`;
            message += `Both you and your referrer will earn from your trading activity! 💰`;
        }

        const translatedButtons = await generateTranslatedMainMenuButtons(userId);
        const keyboard = Markup.inlineKeyboard(translatedButtons);

        return ctx.reply(message, {
            parse_mode: "HTML",
            reply_markup: keyboard.reply_markup,
        });
    } catch (error) {
        console.error(`[START] Unexpected error for user ${userId}:`, error);
        return ctx.reply("❌ An unexpected error occurred. Please try again later.");
    }
}

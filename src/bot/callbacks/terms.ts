import { type Context, Markup } from "telegraf";
import { db } from "../../lib/supabase";
import { getUserIdFromCtx } from "../utils";
import { generateAPIKeyAndWallet } from "../../utils/polymarket/generate-user";
import { CHAIN_ID, HOST } from "../../shared/constants";
import { encryptPrivateKey } from "../../utils/crypto";
import { generateRandomString } from "../../utils/encoding";
import { trackReferralRelationship } from "../../utils/referral/referral-tracker";
import { getUserLanguage } from "../../helpers/user-language";
import { generateWelcomeMessage } from "../ui/messages";
import { generateTranslatedMainMenuButtons } from "../ui/buttons/translated";
import { getUsernameFromCtx } from "../utils";
import { getMessages } from "../../i18n";

export async function showTermsAcceptance(ctx: Context, referrerUsername?: string) {
    const userId = getUserIdFromCtx(ctx);
    const language = await getUserLanguage(userId);
    const messages = getMessages(language);

    const termsMessage = `${messages.termsTitle}\n\n${messages.termsContent}`;

    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(messages.acceptTerms, `accept_terms:${referrerUsername || ""}`)],
        [Markup.button.callback(messages.rejectTerms, "reject_terms")],
    ]);

    return ctx.reply(termsMessage, {
        parse_mode: "Markdown",
        reply_markup: keyboard.reply_markup,
    });
}

export async function handleAcceptTerms(ctx: Context, referrerUsername?: string) {
    const userId = getUserIdFromCtx(ctx);

    try {
        await ctx.deleteMessage();
        const iMsg = await ctx.reply("⚡ Creating your account...");

        // Create new user with terms accepted
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
                // Note: terms_accepted field would need to be added to the database schema
                // For now, we'll assume if a user record exists, they've accepted terms
            },
        ]);

        await ctx.deleteMessage(iMsg.message_id);

        if (insertError && insertError.code !== "23505") {
            console.error(`[TERMS] Error creating user ${userId}:`, insertError);
            return ctx.reply("❌ Error creating your account. Please try again later.");
        }

        const language = await getUserLanguage(userId);
        const translatedButtons = generateTranslatedMainMenuButtons(language);
        const keyboard = Markup.inlineKeyboard(translatedButtons);

        // Generate welcome message for new user
        let message = generateWelcomeMessage(address, solanaAddress || "N/A", "0", 0, 0, language);

        // Add referral success message if applicable
        if (referredCode !== "OPEN") {
            message += `\n\n🎉 **Welcome!** You've been referred by @${referrerUsername}!\n`;
            message += `Both you and your referrer will earn from your trading activity! 💰`;
        }

        return ctx.reply(message, {
            parse_mode: "HTML",
            reply_markup: keyboard.reply_markup,
        });
    } catch (error) {
        console.error(`[TERMS] Unexpected error for user ${userId}:`, error);
        return ctx.reply("❌ An unexpected error occurred. Please try again later.");
    }
}

export async function handleRejectTerms(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);
    const language = await getUserLanguage(userId);
    const messages = getMessages(language);

    await ctx.deleteMessage();

    return ctx.reply(messages.termsRejected, {
        parse_mode: "Markdown",
    });
}

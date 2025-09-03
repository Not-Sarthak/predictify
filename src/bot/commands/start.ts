import { Markup, type Context } from "telegraf";

import { getUserIdFromCtx, getUsernameFromCtx } from "../utils";
import { getSOLBalance, getUserWrappedUSDCBalance } from "../../helpers/get-user-balance";
import { generateWelcomeMessage } from "../ui/messages";
import { generateTranslatedMainMenuButtons } from "../ui/buttons/translated";
import { generateAPIKeyAndWallet } from "../../utils/polymarket/generate-user";
import { CHAIN_ID, HOST } from "../../shared/constants";
import { encryptPrivateKey } from "../../utils/crypto";
import { db } from "../../lib/supabase";
import { generateRandomString } from "../../utils/encoding";
import { getLockedBalance } from "../../utils/polymarket/get-locked-balance";
import { trackReferralRelationship } from "../../utils/referral/referral-tracker";
import { getUserLanguage } from "../../helpers/user-language";
import { getUserWalletAddresses } from "../utils/database/get-user-addresses";
import { getOrSetCache } from "../../utils";

export async function handleStartCommand(ctx: Context) {
    const iMsg1 = await ctx.reply("⚡ Fetching your profile data...");

    const userId = getUserIdFromCtx(ctx);
    const referrerUsername =
        ctx.message && "text" in ctx.message ? ctx.message.text.split(" ")[1] : undefined;

    const [existingUser, language] = await Promise.all([
        getOrSetCache(`user:${userId}:addresses`, () => getUserWalletAddresses(userId), 43200), // Cache Addresses for 12 Hours
        getUserLanguage(userId),
    ]);

    const translatedButtons = generateTranslatedMainMenuButtons(language);
    const keyboard = Markup.inlineKeyboard(translatedButtons);

    if (existingUser && existingUser.wallet_address) {
        const [balance, solBalance, lockedBalance] = await Promise.all([
            getOrSetCache(
                `user:${userId}:usdc_balance`,
                () => getUserWrappedUSDCBalance(existingUser.wallet_address),
                60
            ),
            getOrSetCache(
                `user:${userId}:sol_balance`,
                () => getSOLBalance(existingUser.solana_address),
                43200 // Higher TTL than USDC Balance as it's not used as often
            ),
            getOrSetCache(`user:${userId}:locked_balance`, () => getLockedBalance(userId), 60),
            ctx.deleteMessage(iMsg1.message_id),
        ]);

        const message = generateWelcomeMessage(
            existingUser.wallet_address,
            existingUser.solana_address,
            balance.toString(),
            solBalance,
            lockedBalance,
            language
        );

        return ctx.reply(message, {
            parse_mode: "HTML",
            reply_markup: keyboard.reply_markup,
        });
    } else {
        ctx.deleteMessage(iMsg1.message_id);
        const iMsg2 = await ctx.reply("⚡ Creating your account...");

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

            await ctx.deleteMessage(iMsg2.message_id);

            if (insertError && insertError.code !== "23505") {
                console.error(`[START] Error creating user ${userId}:`, insertError);
                return ctx.reply("❌ Error creating your account. Please try again later.");
            }

            // Optimistic Approach to save time by not fetching balances (EVM, Solana and Locked)
            // after account creation because they won't have any
            let message = generateWelcomeMessage(
                address,
                solanaAddress || "N/A",
                "0",
                0,
                0,
                language
            );

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
            console.error(`[START] Unexpected error for user ${userId}:`, error);
            return ctx.reply("❌ An unexpected error occurred. Please try again later.");
        }
    }
}

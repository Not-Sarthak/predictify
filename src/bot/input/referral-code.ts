import type { Context } from "telegraf";

import { Markup } from "telegraf";
import { db } from "../../lib/supabase";
import { getUserIdFromCtx, getUsernameFromCtx } from "../utils";
import { generateAPIKeyAndWallet } from "../../utils/polymarket/generate-user";
import { CHAIN_ID, HOST } from "../../shared/constants";
import { encryptPrivateKey } from "../../utils/crypto";
import { getSOLBalance, getUserWrappedUSDCBalance } from "../../helpers/get-user-balance";
import { generateTranslatedMainMenuButtons } from "../ui/buttons/translated";
import { generateRandomString } from "../../utils/encoding";
import { clearUserInputState } from "../input/state";
import { getUserLanguage } from "../../helpers/user-language";
import { incrementUserStats } from "../utils/database/update-user-data";

export async function handleReferralCodeTextMessage(ctx: Context, textMessage: string) {
    const userId = getUserIdFromCtx(ctx);
    const userName = getUsernameFromCtx(ctx);
    const referralCode = textMessage.trim();

    // Check if it's the special code "PRED"
    let referrer;
    if (referralCode.toUpperCase() === "PRED") {
        // Use a dummy referrer for the special code
        referrer = {
            id: 0,
            number_of_referrals: 0,
        };
    } else {
        // Check if referral code exists
        const { data: referrerData, error: referralError } = await db("Users")
            .select("*")
            .eq("referral_code", referralCode)
            .single();

        if (referralError || !referrerData) {
            return ctx.reply("❌ Invalid invite code. Please try again with a valid code.");
        }
        referrer = referrerData;
    }

    // Generate wallet and API credentials
    const { address, privateKey, apiCreds, solanaAddress, solanaPrivateKey } =
        await generateAPIKeyAndWallet({
            host: HOST,
            chainId: CHAIN_ID,
        });

    // Generate a referral code for the new user
    const newUserReferralCode = generateRandomString(6);

    // Create new user with all details
    const { error: insertError } = await db("Users").insert([
        {
            id: userId,
            telegram_username: userName,
            wallet_address: address,
            private_key: encryptPrivateKey(privateKey),
            api_credentials: JSON.stringify(apiCreds),
            solana_address: solanaAddress,
            solana_private_key: encryptPrivateKey(solanaPrivateKey),
            referred_code: referralCode,
            referral_code: newUserReferralCode,
            treasury_wallet_address: address,
        },
    ]);

    if (insertError) {
        console.error("Error creating user:", insertError);
        return ctx.reply("❌ Error creating your account. Please try again later.");
    }

    // Update referrer's count (skip for special code "PRED")
    if (referralCode.toUpperCase() !== "PRED") {
        await incrementUserStats(referrer.id, { numberOfReferrals: 1 });
    }

    // Remove from awaiting set
    clearUserInputState(userId.toString());

    // Send welcome message
    const balance = await getUserWrappedUSDCBalance(address);
    const solBalance = solanaAddress ? await getSOLBalance(solanaAddress) : 0;

    const translatedButtons = generateTranslatedMainMenuButtons(await getUserLanguage(userId));
    const keyboard = Markup.inlineKeyboard(translatedButtons);

    // Send custom welcome message
    const customWelcomeMessage = `Welcome to Predictify
We trade headlines for breakfast. 📰⚔
Your wallet's live. Let's degen.

🔐 Your Wallets
• Solana Address: ${solanaAddress || "N/A"}
• Polygon Address: ${address}

💰 Your Balances
• USDC: $${balance}
• SOL: ${solBalance} SOL

🔥 What you can do:
• Blast YES/NO bets with market or limit orders
• Copy top wallets instantly
• Get alerts by category — "Elections", "Crypto", "AI"
• Track PnL and open positions
• Fund your wallet with SOL or Polygon USDC — your choice

👉 Use /fund to load up and start trading
No logins. No browser tabs. Just pure prediction market flow. 🫡

🎟️ Your referral code: <code>${newUserReferralCode}</code>
Share this code with others to invite them to the bot!`;

    return ctx.reply(customWelcomeMessage, {
        parse_mode: "HTML",
        reply_markup: keyboard.reply_markup,
    });
}

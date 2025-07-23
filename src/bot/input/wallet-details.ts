import { clearUserInputState } from "@/bot/input/state";
import { db } from "@/lib/supabase";
import type { Context } from "telegraf";
import { startWalletMonitoring } from "@/watcher/copy-trade";

export async function handleWalletDetailsTextMessage(
    ctx: Context,
    textMessage: string,
    userId: number
) {
    const walletAddress = textMessage;

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        return ctx.reply("❌ Invalid Wallet Address. Try again.");
    }

    try {
        // Check if wallet already exists
        const { data: existingWallet } = await db("Copy_Wallets")
            .select("*")
            .eq("user_id", userId)
            .eq("wallet_address", walletAddress)
            .single();

        if (existingWallet) {
            return ctx.reply("❌ This wallet is already in your watch list.");
        }

        // Insert new wallet
        const { error } = await db("Copy_Wallets").insert([
            {
                user_id: userId,
                wallet_address: walletAddress,
                is_enabled: false, // Start with monitoring disabled
            },
        ]);

        if (error) throw new Error(error.message, { cause: error.cause });

        // No need to get user settings here since wallet starts disabled

        await clearUserInputState(userId.toString());

        const message =
            `✅ Wallet *${walletAddress}* saved successfully!\n\n` +
            `💡 To start monitoring this wallet, go to:\n` +
            `*Auto Trade* → *View Watched Wallets* → Click the wallet to enable monitoring`;

        return ctx.reply(message, {
            parse_mode: "Markdown",
        });
    } catch (error) {
        console.error("Error Adding User Wallet in DB:", error);
        return ctx.reply(`❌ There Was an Error Adding Your Wallet! Please Try Again Later.`, {
            parse_mode: "Markdown",
        });
    }
}

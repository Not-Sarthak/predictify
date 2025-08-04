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

        // Get current user's wallet address
        const { data: currentUser } = await db("Users")
            .select("wallet_address")
            .eq("id", userId)
            .single();

        if (!currentUser) {
            return ctx.reply("❌ User data not found. Please try again.");
        }

        // Check if adding own wallet
        if (currentUser.wallet_address.toLowerCase() === walletAddress.toLowerCase()) {
            return ctx.reply("❌ You cannot add your own wallet to the watch list.");
        }

        // Check for potential circular reference
        const { data: walletOwner } = await db("Users")
            .select("id")
            .eq("wallet_address", walletAddress)
            .single();

        if (walletOwner) {
            // Check if this wallet's owner is already watching the current user
            const { data: reverseWatch } = await db("Copy_Wallets")
                .select("*")
                .eq("user_id", walletOwner.id)
                .eq("wallet_address", currentUser.wallet_address)
                .eq("is_enabled", true)
                .single();

            if (reverseWatch) {
                return ctx.reply(
                    `⚠️ *Circular Reference Detected*\n\n` +
                        `This Wallet is already Monitoring your Wallet. Enabling Would create an Infinite Circular Reference.\n` +
                        { parse_mode: "Markdown" }
                );
            }
        }

        const { error } = await db("Copy_Wallets").insert([
            {
                user_id: userId,
                wallet_address: walletAddress,
                is_enabled: false, // Start with Monitoring Disabled
                percent_ratio: 1, // Default to 100%
            },
        ]);

        if (error) throw new Error(error.message, { cause: error.cause });

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

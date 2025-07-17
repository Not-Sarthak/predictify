import { clearUserInputState } from "@/bot/input/state";
import { db } from "@/lib/supabase";
import type { Context } from "telegraf";

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
        const { error } = await db("Copy_Wallets").insert([
            {
                user_id: userId,
                wallet_address: walletAddress,
            },
        ]);

        if (error) throw new Error(error.message, { cause: error.cause });

        await clearUserInputState(userId.toString());
        return ctx.reply(`✅ Wallet *${walletAddress}* saved successfully!`, {
            parse_mode: "Markdown",
        });
    } catch (error) {
        console.error("Error Adding User Wallet in DB:", error);
        return ctx.reply(`❌ There Was an Error Adding Your Wallet! Please Try Again Later.`, {
            parse_mode: "Markdown",
        });
    }
}

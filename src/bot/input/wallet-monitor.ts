import { getUserWatchedWalletsCount } from "@/bot/utils";
import { db } from "@/lib/supabase";
import type { Context } from "telegraf";

export async function handleWalletMontiorTextMessage(
    ctx: Context,
    textMessage: string,
    userId: number
) {
    const address = textMessage;
    const watchedWallets = await getUserWatchedWalletsCount(userId.toString());

    if (!watchedWallets) {
        return ctx.reply("Something went wrong. Please try again.");
    }

    if (watchedWallets < 3) {
        await db("Copy_Wallets").insert({
            user_id: userId,
            wallet_name: "new_wallet",
            wallet_address: address,
        });
    }

    return ctx.reply("⚠️ You have reached your maximum allowed Wallets");
}

import type { Context } from "telegraf";

import { getUserIdFromCtx } from "@/bot/utils/get-user-id-ctx";
import { db } from "@/lib/supabase";

export async function handleToggleCopyTradeStatus(ctx: Context, action: boolean) {
    const userId = getUserIdFromCtx(ctx);

    await db("Users").update({ is_copytrading_enabled: action }).eq("id", userId);

    if (!action) {
        await db("Copy_Wallets").update({ is_enabled: false }).eq("user_id", userId);
    }

    return ctx.reply(`✅ CopyTrading is ${action ? "Enabled" : "Disabled"}`);
}

export async function handleToggleWalletCopyTradeStatus(ctx: Context, address: string) {
    const userId = getUserIdFromCtx(ctx);

    const wallets = await db("Copy_Wallets").select("*").eq("user_id", userId);

    if (!wallets) {
        return;
    }

    await db("Copy_Wallets")
        .update({ is_enabled: true })
        .eq("user_id", userId)
        .eq("wallet_address", address);

    await db("Copy_Wallets")
        .update({ is_enabled: false })
        .eq("user_id", userId)
        .neq("wallet_address", address);
}

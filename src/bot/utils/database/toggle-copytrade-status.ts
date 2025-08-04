import type { Context } from "telegraf";

import { getUserIdFromCtx } from "@/bot/utils/get-user-id-ctx";
import { db } from "@/lib/supabase";
import {
    startWalletMonitoring,
    stopWalletMonitoring,
    updateSubscription,
} from "@/watcher/copy-trade";

export async function handleToggleCopyTradeStatus(ctx: Context, action: boolean) {
    const userId = getUserIdFromCtx(ctx);

    try {
        // Update user settings
        await db("Users").update({ is_copytrading_enabled: action }).eq("id", userId);

        // Get user's watched wallets and config
        const { data: user } = await db("Users")
            .select("watched_wallets, config_value")
            .eq("id", userId)
            .single();

        if (!action) {
            // Disable all wallets when copy trading is disabled
            await db("Copy_Wallets").update({ is_enabled: false }).eq("user_id", userId);
        }

        // Update monitoring for all watched wallets
        if (user?.watched_wallets && user.watched_wallets.length > 0) {
            const positionPercentage = user.config_value ? parseInt(user.config_value) : 100;

            for (const wallet of user.watched_wallets) {
                await updateSubscription(wallet, userId, action, positionPercentage);
            }
        }

        await ctx.answerCbQuery(action ? "✅ Copy trading enabled" : "❌ Copy trading disabled");

        return ctx.reply(
            action
                ? "✅ Copy trading has been enabled. You will now automatically copy trades from your watched wallets."
                : "❌ Copy trading has been disabled. You will still receive notifications but trades won't be copied.",
            { parse_mode: "Markdown" }
        );
    } catch (error) {
        console.error("Error toggling copy trading:", error);
        await ctx.answerCbQuery("Error updating settings");
        return ctx.reply("❌ Failed to update copy trading settings. Please try again.");
    }
}

export async function handleToggleWalletCopyTradeStatus(ctx: Context, address: string) {
    const userId = getUserIdFromCtx(ctx);

    try {
        // Get all user wallets to toggle off others
        const { data: wallets } = await db("Copy_Wallets").select("*").eq("user_id", userId);

        if (!wallets || wallets.length === 0) {
            return ctx.answerCbQuery("No wallets found");
        }

        // Get user settings
        const { data: user } = await db("Users")
            .select("is_copytrading_enabled, config_value, watched_wallets")
            .eq("id", userId)
            .single();

        const positionPercentage = user?.config_value ? parseInt(user.config_value) : 100;

        // Find the wallet being toggled
        const targetWallet = wallets.find((w) => w.wallet_address === address);
        if (!targetWallet) {
            return ctx.answerCbQuery("Wallet not found");
        }

        // If currently enabled, disable it
        if (targetWallet.is_enabled) {
            // Disable the wallet
            await db("Copy_Wallets")
                .update({ is_enabled: false })
                .eq("user_id", userId)
                .eq("wallet_address", address);

            // Remove from watched_wallets array
            const currentWallets = user?.watched_wallets || [];
            const updatedWallets = currentWallets.filter((w) => w !== address);

            await db("Users").update({ watched_wallets: updatedWallets }).eq("id", userId);

            // Stop monitoring
            await stopWalletMonitoring(address, userId);

            await ctx.answerCbQuery("❌ Wallet monitoring disabled");
        } else {
            // Enable this wallet and disable others (only one active at a time)
            await db("Copy_Wallets")
                .update({ is_enabled: true })
                .eq("user_id", userId)
                .eq("wallet_address", address);

            await db("Copy_Wallets")
                .update({ is_enabled: false })
                .eq("user_id", userId)
                .neq("wallet_address", address);

            // Update watched_wallets array - remove all others and add this one
            await db("Users")
                .update({ watched_wallets: [address] })
                .eq("id", userId);

            // Stop monitoring other wallets
            for (const wallet of wallets) {
                if (wallet.wallet_address !== address && wallet.is_enabled) {
                    await stopWalletMonitoring(wallet.wallet_address, userId);
                }
            }

            // Start monitoring the new wallet
            await startWalletMonitoring(
                address,
                userId,
                user?.is_copytrading_enabled || false,
                positionPercentage
            );

            await ctx.answerCbQuery("✅ Wallet monitoring enabled");
        }
    } catch (error) {
        console.error("Error toggling wallet monitoring:", error);
        await ctx.answerCbQuery("Error updating wallet status");
    }
}

import { setUserInputState } from "@/bot/input/state";
import { getUserIdFromCtx } from "@/bot/utils";
import { getUserCopyTradeConfig, saveCopyTradeConfig } from "@/bot/utils/database/trading-config";
import { redisClient } from "@/lib/redis";
import { db } from "@/lib/supabase";
import { Context, Markup } from "telegraf";
import {
    startWalletMonitoring,
    stopWalletMonitoring,
    updateSubscription,
    getMonitoringStatus,
} from "@/watcher/copy-trade";

export async function handleCopyTradeConfigureMenu(ctx: Context) {
    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    const { data, error } = await getUserCopyTradeConfig(userId);

    if (error) {
        return ctx.reply("⚠️ Error fetching Config.");
    }

    const configMessageValue =
        data && data.config_type
            ? `${data.config_type} (${data.config_value})`
            : "Default (Not Set)";

    const configMessage =
        `💰 *Copy Trader Position %*\n\n` +
        `Choose how much of your balance to use for copy trading:\n\n` +
        `📊 *Current Settings:* ${configMessageValue}`;

    const configButtons = [
        [
            Markup.button.callback("50%", "config_position_50"),
            Markup.button.callback("100%", "config_position_100"),
            Markup.button.callback("Custom", "config_position_custom"),
        ],
        [Markup.button.callback("↩️ Back to Auto Trade", "back_to_autotrade")],
    ];

    await ctx.editMessageText(configMessage, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard(configButtons).reply_markup,
    });
}

export async function handleViewWatchedWallets(ctx: Context) {
    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    try {
        const { data: userWallets, error } = await db("Copy_Wallets")
            .select("*")
            .eq("user_id", Number(userId));

        if (error) throw error;

        if (!userWallets || userWallets.length === 0) {
            const message = `👁️ *Watched Wallets*\n\n` + `⚠️ No Wallets Added\n\n`;

            const buttons = [
                [Markup.button.callback("➕ Add Wallet", "add_new_wallet")],
                [Markup.button.callback("↩️ Back to Auto Trade", "back_to_autotrade")],
            ];

            return ctx.editMessageText(message, {
                parse_mode: "Markdown",
                reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
            });
        }

        // Get user's settings
        const { data: userData } = await db("Users")
            .select("watched_wallets, is_copytrading_enabled")
            .eq("id", Number(userId))
            .single();

        const message =
            `👁️ *Watched Wallets (${userWallets.length}/5)*\n\n` +
            userWallets
                .map((wallet, index) => {
                    const status = wallet.is_enabled ? "✅" : "❌";
                    return `${index + 1}. ${status} *${wallet.wallet_address}*`;
                })
                .join("\n\n") +
            `\n\n*Copy Trading:* ${userData?.is_copytrading_enabled ? "✅ Enabled" : "❌ Disabled"}`;

        const buttons = [
            [
                Markup.button.callback("➕ Add Wallet", "add_new_wallet"),
                Markup.button.callback("🗑️ Remove Wallet", "delete_wallet"),
            ],
            [Markup.button.callback("↩️ Back to Auto Trade", "back_to_autotrade")],
        ];

        await ctx.editMessageText(message, {
            parse_mode: "Markdown",
            reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
        });
    } catch (error) {
        console.error("Error fetching watched wallets:", error);
        return ctx.reply("❌ Failed to fetch watched wallets. Please try again.");
    }
}

export async function handleCopyTradeConfigCallbacks(ctx: Context, action: string) {
    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    try {
        let configType = "";
        let configValue = "";

        switch (action) {
            case "position_50":
                configType = "Position Percentage";
                configValue = "50%";
                break;
            case "position_100":
                configType = "Position Percentage";
                configValue = "100%";
                break;
            case "position_custom":
                configType = "Position Percentage";
                configValue = "Custom";

                await setUserInputState(userId, "config");
                await redisClient.hSet(`user:config_input:${userId}`, "key", "Custom");
                return ctx.reply("🔥 Enter a Percentage: ");
            case "same_proportion":
                configType = "Copy Method";
                configValue = "Same Proportion";
                break;
            case "same_amount":
                configType = "Copy Method";
                configValue = "Same Amount";
                break;
            case "max_amount":
                configType = "Position Limit";
                configValue = "Max Amount";

                await setUserInputState(userId, "config");
                await redisClient.hSet(`user:config_input:${userId}`, "key", "Max");
                return ctx.reply("🔥 Enter an Amount: ");
            default:
                if ("answerCbQuery" in ctx) {
                    await ctx.answerCbQuery("Unknown configuration");
                }
                return;
        }

        const isSuccess = await saveCopyTradeConfig(userId, configType, configValue);

        if (!isSuccess) {
            return ctx.reply("⚠️ Error saving config. Please try again");
        }

        if ("answerCbQuery" in ctx) {
            await ctx.answerCbQuery(`${configType} set to ${configValue}`);
        }
        return ctx.reply(
            `✅ *Configuration Updated*\n\n` +
                `**${configType}:** ${configValue}\n\n` +
                `Your copy trading settings have been updated.`,
            { parse_mode: "Markdown" }
        );
    } catch (error) {
        console.error("Error updating copy trade config:", error);
        await ctx.answerCbQuery("Error Occurred");
        return ctx.reply("❌ Failed to update configuration. Please try again.");
    }
}

export async function handleAddNewWalletCallback(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);

    try {
        const { count, error: countError } = await db("Copy_Wallets")
            .select("*", { count: "exact" })
            .eq("user_id", Number(userId));

        if (countError) throw new Error(countError.message, { cause: countError.cause });

        if (count && count >= 5)
            return ctx.reply(`❌ You have reached your Maximum Wallet Limit (5 wallets)`);
    } catch (error) {
        console.error("Error fetching user copy wallets details: ", error);
        return ctx.reply(`❌ There was an error fetching your details! Please try again.`, {
            parse_mode: "Markdown",
        });
    }

    await setUserInputState(userId.toString(), "walletDetails");

    const message = `🧾 *Add Wallet Address*

📌 *Example:*  
\`0x56687bf447db6ffa42ffe2204a05edaa20f55839\`
`;

    return ctx.reply(message, { parse_mode: "Markdown" });
}

export async function handleDeleteWalletCallback(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);

    try {
        const { data, error: countError } = await db("Copy_Wallets")
            .select("*")
            .eq("user_id", Number(userId));

        if (countError) throw new Error(countError.message, { cause: countError.cause });

        if (!data.length) return ctx.reply(`⚠️ You don't have any added Wallets!`);

        const deleteWalletButtons = Markup.inlineKeyboard(
            data.map((wallet) => {
                return [
                    Markup.button.callback(
                        `${wallet.wallet_address}`,
                        `delete_copy_wallet:${wallet.wallet_address}`
                    ),
                ];
            })
        );

        return ctx.reply(`Your Wallets: `, deleteWalletButtons);
    } catch (error) {
        console.error("Error fetching user copy wallets details: ", error);
        return ctx.reply(
            `❌ There was an error fetching your wallet details! Please try again later.`,
            {
                parse_mode: "Markdown",
            }
        );
    }
}

// New function to handle wallet enable/disable
export async function handleToggleWalletMonitoring(ctx: Context, walletAddress: string) {
    const userId = getUserIdFromCtx(ctx);

    try {
        // Get wallet details
        const { data: wallet, error } = await db("Copy_Wallets")
            .select("*")
            .eq("user_id", Number(userId))
            .eq("wallet_address", walletAddress)
            .single();

        if (error || !wallet) {
            return ctx.answerCbQuery("Wallet not found");
        }

        // Get user settings
        const { data: user } = await db("Users")
            .select("is_copytrading_enabled, config_value")
            .eq("id", Number(userId))
            .single();

        const newStatus = !wallet.is_enabled;
        const positionPercentage = user?.config_value ? parseInt(user.config_value) : 100;

        // Update wallet status in database
        await db("Copy_Wallets")
            .update({ is_enabled: newStatus })
            .eq("user_id", Number(userId))
            .eq("wallet_address", walletAddress);

        // Update monitoring status and watched_wallets array
        if (newStatus) {
            // Get current watched_wallets
            const { data: currentUser } = await db("Users")
                .select("watched_wallets")
                .eq("id", Number(userId))
                .single();

            const currentWallets = currentUser?.watched_wallets || [];
            if (!currentWallets.includes(walletAddress)) {
                currentWallets.push(walletAddress);
                await db("Users")
                    .update({ watched_wallets: currentWallets })
                    .eq("id", Number(userId));
            }

            // Start monitoring
            await startWalletMonitoring(
                walletAddress,
                Number(userId),
                user?.is_copytrading_enabled || false,
                positionPercentage
            );
        } else {
            // Get current watched_wallets and remove this one
            const { data: currentUser } = await db("Users")
                .select("watched_wallets")
                .eq("id", Number(userId))
                .single();

            const currentWallets = currentUser?.watched_wallets || [];
            const updatedWallets = currentWallets.filter((w) => w !== walletAddress);

            await db("Users").update({ watched_wallets: updatedWallets }).eq("id", Number(userId));

            // Stop monitoring
            await stopWalletMonitoring(walletAddress, Number(userId));
        }

        await ctx.answerCbQuery(
            newStatus ? "✅ Wallet monitoring enabled" : "❌ Wallet monitoring disabled"
        );

        // Refresh the view
        return handleViewWatchedWallets(ctx);
    } catch (error) {
        console.error("Error toggling wallet monitoring:", error);
        return ctx.answerCbQuery("Error updating wallet status");
    }
}

// Handle global copy trading toggle
export async function handleToggleCopyTrading(ctx: Context, enable: boolean) {
    const userId = getUserIdFromCtx(ctx);

    try {
        // Update user settings
        await db("Users").update({ is_copytrading_enabled: enable }).eq("id", Number(userId));

        // Get user's watched wallets and config
        const { data: user } = await db("Users")
            .select("watched_wallets, config_value")
            .eq("id", Number(userId))
            .single();

        if (user?.watched_wallets && user.watched_wallets.length > 0) {
            const positionPercentage = user.config_value ? parseInt(user.config_value) : 100;

            // Update monitoring for all watched wallets
            for (const wallet of user.watched_wallets) {
                await updateSubscription(wallet, Number(userId), enable, positionPercentage);
            }
        }

        await ctx.answerCbQuery(enable ? "✅ Copy trading enabled" : "❌ Copy trading disabled");

        return ctx.reply(
            enable
                ? "✅ Copy trading has been enabled. You will now automatically copy trades from your watched wallets."
                : "❌ Copy trading has been disabled. You will still receive notifications but trades won't be copied.",
            { parse_mode: "Markdown" }
        );
    } catch (error) {
        console.error("Error toggling copy trading:", error);
        return ctx.answerCbQuery("Error updating settings");
    }
}

// Get monitoring statistics
export async function handleMonitoringStats(ctx: Context) {
    const stats = getMonitoringStatus();

    const message =
        `📊 *Monitoring Statistics*\n\n` +
        `👁️ Total Wallets Monitored: ${stats.totalWallets}\n` +
        `👥 Total Subscribers: ${stats.totalSubscribers}\n\n` +
        `*Active Monitors:*\n` +
        stats.wallets
            .map(
                (w) =>
                    `• ${w.wallet.slice(0, 6)}...${w.wallet.slice(-4)}: ${w.subscriberCount} users (${w.copyTradingCount} copying)`
            )
            .join("\n");

    return ctx.reply(message, { parse_mode: "Markdown" });
}

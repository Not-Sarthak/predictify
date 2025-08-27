import { setUserInputState, clearUserInputState } from "../input/state";
import { getUserIdFromCtx } from "../utils";
import { getUserCopyTradeConfig, saveCopyTradeConfig } from "../utils/database/trading-config";
import { redisClient } from "../../lib/redis";
import { db } from "../../lib/supabase";
import { Context, Markup } from "telegraf";
import {
    startWalletMonitoring,
    stopWalletMonitoring,
    updateSubscription,
    getMonitoringStatus,
} from "../../watcher/copy-trade";
import { getUserLanguage } from "../../helpers/user-language";
import { t } from "../../i18n";

export async function handleCopyTradeConfigureMenu(ctx: Context) {
    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    const language = await getUserLanguage(Number(userId));
    const { data, error } = await getUserCopyTradeConfig(userId);

    if (error) {
        return ctx.reply("⚠️ Error fetching Config.");
    }

    const configMessageValue =
        data && data.config_type
            ? `${data.config_type} (${data.config_value})`
            : t("defaultNotSet", language);

    const configMessage =
        `${t("globalCopyTraderPositionTitle", language)}\n\n` +
        `${t("setDefaultPositionPercentage", language)}\n\n` +
        `${t("currentDefault", language)} ${configMessageValue}\n\n` +
        `${t("individualWalletOverride", language)}`;

    const configButtons = [
        [
            Markup.button.callback("50%", "config_position_50"),
            Markup.button.callback("100%", "config_position_100"),
            Markup.button.callback(t("enterCustom", language), "config_position_custom"),
        ],
        [Markup.button.callback(t("backToAutoTrade", language), "back_to_autotrade")],
    ];

    await ctx.editMessageText(configMessage, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard(configButtons).reply_markup,
    });
}

export async function handleViewWatchedWallets(ctx: Context) {
    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    const language = await getUserLanguage(Number(userId));

    try {
        const { data: userWallets, error } = await db("Copy_Wallets")
            .select("*")
            .eq("user_id", Number(userId));

        if (error) throw error;

        if (!userWallets || userWallets.length === 0) {
            const message =
                `👁️ *${t("watchedWalletsTitle", language)}*\n\n` +
                `⚠️ ${t("noWalletsAdded", language)}\n\n`;

            const buttons = [
                [Markup.button.callback(`➕ ${t("addWallet", language)}`, "add_new_wallet")],
                [Markup.button.callback(t("backToAutoTrade", language), "back_to_autotrade")],
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
            `👁️ *${t("watchedWalletsTitle", language)} (${userWallets.length}/5)*\n\n` +
            userWallets
                .map((wallet, index) => {
                    const status = wallet.is_enabled ? "✅" : "❌";
                    const percentage = wallet.percent_ratio
                        ? `${wallet.percent_ratio * 100}%`
                        : "100%";
                    return `${index + 1}. ${status} *${wallet.wallet_address}*\n   💰 ${t("position", language)}: ${percentage}`;
                })
                .join("\n\n") +
            `\n\n*${t("copyTrading", language)}:* ${userData?.is_copytrading_enabled ? `✅ ${t("enabled", language)}` : `❌ ${t("disabled", language)}`}`;

        const buttons = [
            [
                Markup.button.callback(`➕ ${t("addWallet", language)}`, "add_new_wallet"),
                Markup.button.callback(`🗑️ ${t("removeWallet", language)}`, "delete_wallet"),
            ],
            [Markup.button.callback(t("configurePosition", language), "configure_wallets")],
            [Markup.button.callback(t("backToAutoTrade", language), "back_to_autotrade")],
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
    const language = await getUserLanguage(Number(userId));

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
                configValue = t("enterCustom", language);

                await setUserInputState(userId, "config");
                await redisClient.hSet(
                    `user:config_input:${userId}`,
                    "key",
                    t("enterCustom", language)
                );
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

    const language = await getUserLanguage(Number(userId));
    const message = `${t("addWalletTitle", language)}\n\n${t("addWalletDescription", language)}\n\n📌 *Example:*  
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

export async function handleToggleWalletMonitoring(ctx: Context, walletAddress: string) {
    const userId = getUserIdFromCtx(ctx);

    try {
        const { data: wallet, error } = await db("Copy_Wallets")
            .select("*")
            .eq("user_id", Number(userId))
            .eq("wallet_address", walletAddress)
            .single();

        if (error || !wallet) {
            return ctx.answerCbQuery("Wallet not found");
        }

        const { data: user } = await db("Users")
            .select("is_copytrading_enabled, wallet_address")
            .eq("id", Number(userId))
            .single();

        const newStatus = !wallet.is_enabled;

        if (newStatus) {
            const { data: walletOwner } = await db("Users")
                .select("id")
                .eq("wallet_address", walletAddress)
                .single();

            if (walletOwner) {
                if (user?.wallet_address) {
                    const { data: reverseWatch } = await db("Copy_Wallets")
                        .select("*")
                        .eq("user_id", walletOwner.id)
                        .eq("wallet_address", user.wallet_address)
                        .eq("is_enabled", true)
                        .single();

                    if (reverseWatch) {
                        await ctx.answerCbQuery("⚠️ Cannot enable: Circular reference detected");
                        return ctx.reply(
                            `⚠️ *Circular Reference Detected*\n\n` +
                                `This Wallet is already Monitoring your Wallet. Enabling Would create an Infinite Circular Reference.`,
                            { parse_mode: "Markdown" }
                        );
                    }
                }
            }
        }

        // Use wallet-specific percentage or default to 100%
        const positionPercentage = wallet.percent_ratio ? wallet.percent_ratio * 100 : 100;

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

        const language = await getUserLanguage(Number(userId));
        await ctx.answerCbQuery(
            newStatus
                ? t("walletMonitoringEnabled", language)
                : t("walletMonitoringDisabled", language)
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
    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    const language = await getUserLanguage(Number(userId));

    try {
        await db("Users").update({ is_copytrading_enabled: enable }).eq("id", Number(userId));

        await ctx.answerCbQuery(
            enable ? t("copyTradingEnabled", language) : t("copyTradingDisabled", language)
        );

        return ctx.reply(
            enable
                ? t("copyTradingEnabledMessage", language)
                : t("copyTradingDisabledMessage", language),
            { parse_mode: "Markdown" }
        );
    } catch (error) {
        console.error("Error toggling copy trading:", error);
        return ctx.reply("❌ An error occurred while updating your settings.");
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

// Handle configure wallets menu
export async function handleConfigureWalletsMenu(ctx: Context) {
    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    try {
        const { data: userWallets, error } = await db("Copy_Wallets")
            .select("*")
            .eq("user_id", Number(userId))
            .order("created_at", { ascending: true });

        if (error) throw error;

        if (!userWallets || userWallets.length === 0) {
            const language = await getUserLanguage(Number(userId));
            return ctx.reply(t("noWalletsAddedYet", language));
        }

        const language = await getUserLanguage(Number(userId));
        const message = `${t("configureWalletPositionTitle", language)}\n\n${t("selectWalletToConfigurePosition", language)}`;

        const buttons = userWallets.map((wallet) => {
            const percentage = wallet.percent_ratio ? `${wallet.percent_ratio * 100}%` : "100%";
            const walletDisplay = `${wallet.wallet_address.slice(0, 6)}...${wallet.wallet_address.slice(-4)}`;
            return [
                Markup.button.callback(
                    `${walletDisplay} (${percentage})`,
                    `config_wallet:${wallet.wallet_address}`
                ),
            ];
        });

        buttons.push([Markup.button.callback("↩️ Back", "view_watched_wallets")]);

        await ctx.editMessageText(message, {
            parse_mode: "Markdown",
            reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
        });
    } catch (error) {
        console.error("Error in configure wallets menu:", error);
        return ctx.reply("❌ Failed to load wallet configuration. Please try again.");
    }
}

// Handle individual wallet configuration
export async function handleConfigureWallet(ctx: Context, walletAddress: string) {
    const userId = getUserIdFromCtx(ctx);

    try {
        const { data: wallet, error } = await db("Copy_Wallets")
            .select("*")
            .eq("user_id", Number(userId))
            .eq("wallet_address", walletAddress)
            .single();

        if (error || !wallet) {
            return ctx.answerCbQuery("Wallet not found");
        }

        const currentPercentage = wallet.percent_ratio ? `${wallet.percent_ratio * 100}%` : "100%";
        const walletDisplay = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;

        const language = await getUserLanguage(Number(userId));
        const message =
            `${t("configurePositionForWallet", language)}\n\n` +
            `📱 Wallet: \`${walletDisplay}\`\n` +
            `📊 Current: ${currentPercentage}\n\n` +
            `Choose position percentage for this wallet:`;

        const buttons = [
            [
                Markup.button.callback("25%", `wallet_config:${walletAddress}:25`),
                Markup.button.callback("50%", `wallet_config:${walletAddress}:50`),
                Markup.button.callback("75%", `wallet_config:${walletAddress}:75`),
            ],
            [
                Markup.button.callback("100%", `wallet_config:${walletAddress}:100`),
                Markup.button.callback(
                    `${t("enterCustom", language)} %`,
                    `wallet_config:${walletAddress}:custom`
                ),
            ],
            [Markup.button.callback("↩️ Back", "configure_wallets")],
        ];

        await ctx.editMessageText(message, {
            parse_mode: "Markdown",
            reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
        });
    } catch (error) {
        console.error("Error configuring wallet:", error);
        return ctx.answerCbQuery("Error loading wallet configuration");
    }
}

export async function handleSetWalletPercentage(
    ctx: Context,
    walletAddress: string,
    percentage: string
) {
    const userId = getUserIdFromCtx(ctx);

    if (percentage === "custom") {
        await redisClient.hSet(`user:config_input:${userId}`, {
            key: "wallet_percentage",
            walletAddress: walletAddress,
        });
        await setUserInputState(userId.toString(), "wallet_percentage");
        return ctx.reply(`🔥 Enter position percentage for this wallet (1-100):`);
    }

    try {
        const percentageNum = parseInt(percentage);

        if (isNaN(percentageNum) || percentageNum < 1 || percentageNum > 100) {
            await clearUserInputState(userId.toString());
            await redisClient.del(`user:config_input:${userId}`);
            return ctx.reply("❌ Invalid percentage. Please enter a number between 1 and 100.");
        }

        const percentValue = percentageNum / 100;

        const { error } = await db("Copy_Wallets")
            .update({ percent_ratio: percentValue })
            .eq("user_id", Number(userId))
            .eq("wallet_address", walletAddress);

        if (error) throw error;

        const { data: user } = await db("Users")
            .select("is_copytrading_enabled")
            .eq("id", Number(userId))
            .single();

        if (user?.is_copytrading_enabled) {
            await updateSubscription(walletAddress, Number(userId), true, percentageNum);
        }

        await clearUserInputState(userId.toString());
        await redisClient.del(`user:config_input:${userId}`);

        const walletDisplay = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
        await ctx.reply(
            `✅ *Configuration Updated*\n\n` +
                `Wallet: \`${walletDisplay}\`\n` +
                `Position %: ${percentageNum}%\n\n` +
                `Config: ${percentageNum}% of your Balance.`,
            { parse_mode: "Markdown" }
        );
    } catch (error) {
        console.error("Error setting wallet percentage:", error);
        if ("answerCbQuery" in ctx) {
            return ctx.answerCbQuery("Error updating configuration");
        }
        return (ctx as Context).reply("❌ Error Updating Configuration.");
    }
}

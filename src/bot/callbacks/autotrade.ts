import { awaitingConfigInputSet, awaitingWalletDetailsInputSet } from "@/bot";
import { AUTO_TRADE_MENU_BUTTONS } from "@/bot/ui/buttons";
import { getUserIdFromCtx } from "@/bot/utils";
import {
    checkCopyTradeUserStatus,
    checkWalletCopyTradeStatus,
} from "@/bot/utils/database/check-copy-trade-status";
import { getUserCopyTradeConfig, saveCopyTradeConfig } from "@/bot/utils/database/trading-config";
import { db } from "@/lib/supabase";
import { Context, Markup } from "telegraf";

export async function handleAutoTradeMenu(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);

    const [walletStatusList, userCopyTradeStatus] = await Promise.all([
        await checkWalletCopyTradeStatus(userId.toString()),
        await checkCopyTradeUserStatus(userId.toString()),
    ]);

    if (!walletStatusList) {
        return ctx.reply("No Added Wallets");
    }

    const watchedWalletsCount = walletStatusList.length;

    const statusMessage =
        `🤖 *AutoTrade Menu*\n\n` +
        `👁️ *Monitoring:* ${watchedWalletsCount}/3 Wallets\n\n` +
        `Select an Action:`;

    const walletButtons = walletStatusList.map((wallet) => {
        const emoji = wallet.is_enabled ? "✅" : "🔔";
        const shortAddress =
            wallet.wallet_address.slice(0, 6) + "..." + wallet.wallet_address.slice(-4);
        return [
            Markup.button.callback(
                `${emoji} ${shortAddress}`,
                `toggle_wallet_ct:${wallet.wallet_address}`
            ),
        ];
    });

    const combinedButtons = [
        ...walletButtons,
        [
            Markup.button.callback(
                userCopyTradeStatus ? "❌ Disable CopyTrade" : "✅ Enable CopyTrade",
                `toggle_copy_trade:${!userCopyTradeStatus}`
            ),
        ],
        ...AUTO_TRADE_MENU_BUTTONS,
    ];

    await ctx.editMessageText(statusMessage, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard(combinedButtons).reply_markup,
    });
}

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
        [Markup.button.callback("↩️ Back to Auto Trade", "start:autotrade")],
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
                [Markup.button.callback("↩️ Back to Auto Trade", "start:autotrade")],
            ];

            return ctx.editMessageText(message, {
                parse_mode: "Markdown",
                reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
            });
        }

        const message =
            `👁️ *Watched Wallets (${userWallets.length}/3)*\n\n` +
            userWallets
                .map(
                    (wallet, index) =>
                        `${index + 1}. *${wallet.wallet_name}*\n` +
                        `   \`${wallet.wallet_address}\``
                )
                .join("\n\n");

        const buttons = [
            [
                Markup.button.callback("➕ Add Wallet", "add_new_wallet"),
                Markup.button.callback("🗑️ Remove Wallet", "delete_wallet"),
            ],
            [Markup.button.callback("↩️ Back to Auto Trade", "start:autotrade")],
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

                awaitingConfigInputSet.set(userId.toString(), "Custom");
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

                awaitingConfigInputSet.set(userId.toString(), "Max");
                return ctx.reply("🔥 Enter an Amount: ");
            default:
                await ctx.answerCbQuery("Unknown configuration");
                return;
        }

        const isSuccess = await saveCopyTradeConfig(userId, configType, configValue);

        if (!isSuccess) {
            return ctx.reply("⚠️ Error saving config. Please try again");
        }

        await ctx.answerCbQuery(`${configType} set to ${configValue}`);
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

        if (count === 3) return ctx.reply(`❌ You have reached your Maximum Wallet Limit`);
    } catch (error) {
        console.error("Error fetching user copy wallets details: ", error);
        return ctx.reply(`❌ There was an error fetching your details! Please try again.`, {
            parse_mode: "Markdown",
        });
    }

    awaitingWalletDetailsInputSet.add(userId.toString());

    const message = `🧾 *Add Wallet Instructions*

Please Enter Your Wallet in the Following Format:

\`<wallet_name> <wallet_address>\`

📌 *Example:*  
\`my_wallet 0x56687bf447db6ffa42ffe2204a05edaa20f55839\`
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
                        `${wallet.wallet_name} (${wallet.wallet_address})`,
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

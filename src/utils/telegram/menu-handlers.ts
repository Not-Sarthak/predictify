import { Context, Markup } from "telegraf";
import { supabase } from "../../lib/supabase";

export async function handleCopyTradeConfigureMenu(ctx: Context) {
    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    // TODO: Get user's current configuration settings
    // const userConfig = await getUserCopyTradeConfig(userId);

    const configMessage =
        `💰 *Copy Trader Position %*\n\n` +
        `Choose how much of your balance to use for copy trading:\n\n` +
        `📊 *Current Settings:* Default (Not Set)`;

    const configButtons = [
        [
            Markup.button.callback("50%", "config_position_50"),
            Markup.button.callback("100%", "config_position_100"),
            Markup.button.callback("Custom", "config_position_custom"),
        ],
        [
            Markup.button.callback("Same Proportion", "config_same_proportion"),
            Markup.button.callback("Same Amount", "config_same_amount"),
        ],
        [Markup.button.callback("Max Amount", "config_max_amount")],
        [Markup.button.callback("↩️ Back to Auto Trade", "start_autotrade")],
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
        const { data: userWallets, error } = await supabase
            .from("Copy_Wallets")
            .select("*")
            .eq("user_id", Number(userId));

        if (error) throw error;

        if (!userWallets || userWallets.length === 0) {
            const message =
                `👁️ *Watched Wallets*\n\n` +
                `⚠️ No Wallets Added\n\n` +
                `Add wallets to start monitoring their trading activity.`;

            const buttons = [
                [Markup.button.callback("➕ Add Wallet", "add_new_wallet")],
                [Markup.button.callback("↩️ Back to Auto Trade", "start_autotrade")],
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
                .join("\n\n") +
            `\n\n💡 *Tip:* ${userWallets.length < 3 ? "You can add more wallets." : "Maximum wallets reached."}`;

        const buttons = [
            [
                Markup.button.callback("➕ Add Wallet", "add_new_wallet"),
                Markup.button.callback("🗑️ Remove Wallet", "delete_wallet"),
            ],
            [Markup.button.callback("↩️ Back to Auto Trade", "start_autotrade")],
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

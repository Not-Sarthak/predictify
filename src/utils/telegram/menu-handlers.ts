import { Context, Markup } from "telegraf";
import { getUserWrappedUSDCBalance, getUserTotalBalance } from "../../helpers/get-user-balance";
import { supabase } from "../../config/supabase";

export async function handleSubscriptionsMenu(ctx: Context) {
    const subscriptionButtons = [
        [
            Markup.button.callback("🔔 Subscribe", "subscription_subscribe"),
            Markup.button.callback("🔕 Unsubscribe", "subscription_unsubscribe"),
        ],
        [Markup.button.callback("📋 My Subscriptions", "subscription_manage")],
        [Markup.button.callback("❌ Close", "close_menu")],
    ];

    return ctx.editMessageReplyMarkup(Markup.inlineKeyboard(subscriptionButtons).reply_markup);
}

export async function handleSubscribeMenu(ctx: Context) {
    const { SUBSCRIBE_MESSAGE, SUBSCRIBE_BUTTONS } = await import("../../constants/telegram");
    return ctx
        .reply(SUBSCRIBE_MESSAGE, Markup.inlineKeyboard(SUBSCRIBE_BUTTONS))
        .then(() => ctx.answerCbQuery());
}

export async function handleUnsubscribeMenu(ctx: Context) {
    const { UNSUBSCRIBE_MESSAGE, UNSUBSCRIBE_BUTTONS } = await import("../../constants/telegram");
    return ctx
        .reply(UNSUBSCRIBE_MESSAGE, Markup.inlineKeyboard(UNSUBSCRIBE_BUTTONS))
        .then(() => ctx.answerCbQuery());
}

export async function handleTradeMenu(ctx: Context) {
    const tradeButtons = [
        [
            Markup.button.callback("⚡ Open Position", "trade_position_open"),
            Markup.button.callback("🌂 Close Position", "trade_position_close"),
        ],
        [
            Markup.button.callback("📈 View Positions", "trade_position_view"),
            Markup.button.callback("🔎 Top Markets", "trade_top_markets_view"),
        ],
        [Markup.button.callback("❌ Close", "close_menu")],
    ];

    return ctx.editMessageReplyMarkup(Markup.inlineKeyboard(tradeButtons).reply_markup);
}

export async function handleAutoTradeMenu(ctx: Context) {
    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    // TODO: Check if copy trading is currently enabled for this user
    // const isCopyTradeEnabled = await checkCopyTradeStatus(userId);
    const isCopyTradeEnabled = false;

    // TODO: Get user's watched wallets count
    // const watchedWalletsCount = await getUserWatchedWalletsCount(userId);
    const watchedWalletsCount = 0;

    const statusMessage = `🤖 *AutoTrade Menu*\n\n` +
        `📊 *Status:* ${isCopyTradeEnabled ? '✅ Copy Trading Enabled' : '⏸️ Watch Only Mode'}\n` +
        `👁️ *Monitoring:* ${watchedWalletsCount}/3 Wallets\n\n` +
        `${isCopyTradeEnabled 
            ? '🔄 *Mode:* Watching + Auto Trading' 
            : '👀 *Mode:* Watching Only (No Trading)'
        }\n\n` +
        `Select an Action:`;

    const autoTradeButtons = [
        [
            Markup.button.callback("➕ Add Wallet", "add_new_wallet"),
            Markup.button.callback("🗑️ Delete Wallet", "delete_wallet"),
        ],
        [
            Markup.button.callback("👁️ View Watched Wallets", "view_watched_wallets"),
            Markup.button.callback("💰 Configure", "copy_trade_configure"),
        ],
        [
            Markup.button.callback(
                isCopyTradeEnabled ? "🛑 Stop Copy Trade" : "✅ Enable Copy Trade",
                isCopyTradeEnabled ? "stop_copy_trade" : "enable_copy_trade"
            )
        ],
        [Markup.button.callback("❌ Close", "close_menu")],
    ];

    await ctx.editMessageText(statusMessage, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard(autoTradeButtons).reply_markup
    });
}

export async function handleSettingsMenu(ctx: Context) {
    const settingsButtons = [
        [Markup.button.callback("💼 Wallet Settings", "wallet_settings_menu")],
        [Markup.button.callback("❌ Close", "close_menu")],
    ];

    return ctx.editMessageReplyMarkup(Markup.inlineKeyboard(settingsButtons).reply_markup);
}

export async function handleWalletSettingsMenu(ctx: Context) {
    try {
        const userId = ctx.from?.id;

        const { data: user, error } = await supabase
            .from("Users")
            .select("*")
            .eq("id", userId)
            .single();

        if (error || !user) {
            console.error("Failed to fetch user wallet:", error);
            return ctx.reply("❌ Unable to retrieve wallet info.");
        }

        const evmWalletAddress = user.wallet_address;
        const solanaWalletAddress = user.solana_address;
        const [usdcBalance, totalBalance] = await Promise.all([
            getUserWrappedUSDCBalance(evmWalletAddress),
            getUserTotalBalance(evmWalletAddress),
        ]);

        const message =
            `🔑 <b>Your EVM Wallet Address:</b>\n<code>${evmWalletAddress}</code>\n\n` +
            `🔑 <b>Your Solana Wallet Address:</b>\n<code>${solanaWalletAddress || "N/A"}</code>\n\n` +
            `💵 <b>USDC Balance:</b> $${usdcBalance}\n` +
            `💰 <b>Total Balance (All tokens):</b> $${totalBalance}`;

        const walletSettingsMenu = Markup.inlineKeyboard([
            [Markup.button.callback("🔑 Export EVM Private Key", "export_private_key:evm")],
            [Markup.button.callback("🔑 Export Solana Private Key", "export_private_key:solana")],
        ]);

        return ctx.reply(message, {
            parse_mode: "HTML",
            reply_markup: walletSettingsMenu.reply_markup,
        });
    } catch (err) {
        console.error("Error in wallet settings menu:", err);
        return ctx.reply("❌ Something went wrong. Please try again.");
    }
}

export async function handleCopyTradeConfigureMenu(ctx: Context) {
    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    // TODO: Get user's current configuration settings
    // const userConfig = await getUserCopyTradeConfig(userId);
    
    const configMessage = `💰 *Copy Trader Position %*\n\n` +
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
        [
            Markup.button.callback("Max Amount", "config_max_amount"),
        ],
        [
            Markup.button.callback("↩️ Back to Auto Trade", "start_autotrade"),
        ],
    ];

    await ctx.editMessageText(configMessage, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard(configButtons).reply_markup
    });
}

export async function handleViewWatchedWallets(ctx: Context) {
    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    try {
        // TODO: Get watched wallets from socket server or database
        // For now, get from Copy_Wallets table
        const { data: userWallets, error } = await supabase
            .from("Copy_Wallets")
            .select("*")
            .eq("user_id", userId);

        if (error) throw error;

        if (!userWallets || userWallets.length === 0) {
            const message = `👁️ *Watched Wallets*\n\n` +
                `⚠️ No Wallets Added\n\n` +
                `Add wallets to start monitoring their trading activity.`;

            const buttons = [
                [Markup.button.callback("➕ Add Wallet", "add_new_wallet")],
                [Markup.button.callback("↩️ Back to Auto Trade", "start_autotrade")],
            ];

            return ctx.editMessageText(message, {
                parse_mode: "Markdown",
                reply_markup: Markup.inlineKeyboard(buttons).reply_markup
            });
        }

        const message = `👁️ *Watched Wallets (${userWallets.length}/3)*\n\n` +
            userWallets.map((wallet, index) => 
                `${index + 1}. **${wallet.wallet_name}**\n` +
                `   \`${wallet.wallet_address}\`\n`
            ).join('\n') +
            `\n💡 *Tip:* ${userWallets.length < 3 ? 'You can add more wallets.' : 'Maximum wallets reached.'}`;

        const buttons = [
            [
                Markup.button.callback("➕ Add Wallet", "add_new_wallet"),
                Markup.button.callback("🗑️ Remove Wallet", "delete_wallet"),
            ],
            [Markup.button.callback("↩️ Back to Auto Trade", "start_autotrade")],
        ];

        await ctx.editMessageText(message, {
            parse_mode: "Markdown",
            reply_markup: Markup.inlineKeyboard(buttons).reply_markup
        });

    } catch (error) {
        console.error("Error fetching watched wallets:", error);
        return ctx.reply("❌ Failed to fetch watched wallets. Please try again.");
    }
}

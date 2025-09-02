import {
    BACK_TO_MAIN_MENU_BUTTON,
    BRIDGE_BUTTON,
    CLOSE_BUTTON,
    getBackToMainMenuButton,
    getCloseButton,
} from "../../ui/buttons/common";
import { Markup } from "telegraf";
import { getUserLanguage } from "../../../helpers/user-language";
import { getMessages, t, type SupportedLanguage } from "../../../i18n";

export const MAIN_MENU_BUTTONS = [
    [
        Markup.button.callback("🔔 Subscriptions", `start:subscriptions`),
        Markup.button.callback("🔥 Trade", `start:trade`),
    ],
    [
        Markup.button.callback("🤖 AutoTrade", `start:autotrade`),
        Markup.button.callback("📈 Portfolio", "trade_position_view"),
    ],
    [
        Markup.button.callback("💼 Wallet/Funds", "settings:wallet"),
        Markup.button.callback("👤 View Profile", "view_profile"),
    ],
];

// Translated menu generators
export function generateTranslatedSubscriptionMenuButtons(language: SupportedLanguage) {
    const t = getMessages(language);

    return [
        [
            Markup.button.callback(
                `🔔 ${t.subscribeAction.replace("🔔 ", "")}`,
                "subscriptions:subscribe"
            ),
            Markup.button.callback(
                `🔕 ${t.unsubscribeAction.replace("🔕 ", "")}`,
                "subscriptions:unsubscribe"
            ),
        ],
        [
            Markup.button.callback(
                `📋 ${t.mySubscriptions.replace("📋 ", "")}`,
                "subscriptions:view"
            ),
            Markup.button.callback(
                `✨ ${t.enterCustom.replace("✨ ", "")}`,
                "subscriptions:custom"
            ),
        ],
        [
            Markup.button.callback(
                `🛎️ ${t.managePriceAlerts.replace("🛎️ ", "")}`,
                "edit_price_alerts"
            ),
        ],
        [getBackToMainMenuButton(language)],
    ];
}
export async function generateMainMenuButtons(userId: number) {
    const language = await getUserLanguage(userId);
    return [
        [
            Markup.button.callback(t("subscriptions", language), `start:subscriptions`),
            Markup.button.callback(t("trade", language), `start:trade`),
        ],
        [
            Markup.button.callback(t("autoTrade", language), `start:autotrade`),
            Markup.button.callback(t("portfolio", language), "trade_position_view"),
        ],
        [
            Markup.button.callback(t("walletFunds", language), "settings:wallet"),
            Markup.button.callback(t("viewProfile", language), "view_profile"),
        ],
    ];
}

export function generateTradeMenuButtons(language: SupportedLanguage) {
    return [
        [
            Markup.button.callback(t("topMarkets", language), "trade_top_markets_view"),
            Markup.button.callback(t("zerodayToExpiry", language), "trade_markets_dte"),
        ],
        [
            Markup.button.callback(t("openPosition", language), "trade_position_open"),
            Markup.button.callback(t("closePositionBtn", language), "trade_position_close"),
        ],
        [Markup.button.callback(t("highProbabilityMarkets", language), "strategies:highprob")],
        [getBackToMainMenuButton(language)],
    ];
}

export async function generateAutoTradeMenuButtons(userId: number) {
    const language = await getUserLanguage(userId);
    return [
        [
            Markup.button.callback(t("addWallet", language), "add_new_wallet"),
            Markup.button.callback(t("deleteWallet", language), "delete_wallet"),
        ],
        [
            Markup.button.callback(t("viewWatchedWallets", language), "view_watched_wallets"),
            Markup.button.callback(t("configureCopyTrade", language), "copy_trade_configure_menu"),
        ],
        [await getCloseButton(userId)],
    ];
}

// Keep original exports for backward compatibility
export const SUBSCRIPTIONS_MENU_BUTTONS = [
    [
        Markup.button.callback("🔔 Subscribe", "subscriptions:subscribe"),
        Markup.button.callback("🔕 Unsubscribe", "subscriptions:unsubscribe"),
    ],
    [
        Markup.button.callback("📋 My Subscriptions", "subscriptions:view"),
        Markup.button.callback("✨ Enter Custom", "subscriptions:custom"),
    ],
    [Markup.button.callback("🛎️ Manage Price Alerts", "edit_price_alerts")],
    [BACK_TO_MAIN_MENU_BUTTON],
];

export const TRADE_MENU_BUTTONS = [
    [
        Markup.button.callback("🔎 Top Markets", "trade_top_markets_view"),
        Markup.button.callback("⏰ 0DTE", "trade_markets_dte"),
    ],
    [
        Markup.button.callback("⚡ Open Position", "trade_position_open"),
        Markup.button.callback("🌂 Close Position", "trade_position_close"),
    ],
    [Markup.button.callback("🎯 High Prob Markets", "strategies:highprob")],
    [BACK_TO_MAIN_MENU_BUTTON],
];

export const AUTO_TRADE_MENU_BUTTONS = [
    [
        Markup.button.callback("➕ Add Wallet", "add_new_wallet"),
        Markup.button.callback("🗑️ Delete Wallet", "delete_wallet"),
    ],
    [
        Markup.button.callback("👁️ View Watched Wallets", "view_watched_wallets"),
        Markup.button.callback("💰 Configure", "copy_trade_configure_menu"),
    ],
    [CLOSE_BUTTON],
];

export const TRADE_STRATEGIES_MENU_BUTTONS = [
    [Markup.button.callback("🎯 High-Probability Markets", "strategies:highprob")],
    [Markup.button.callback("🔬 More Strategies (Coming Soon)", "strategies:coming_soon")],
    [BACK_TO_MAIN_MENU_BUTTON],
];

export const WALLET_SETTINGS_MENU = [
    [
        Markup.button.callback("🔑 Export EVM Key", "export_private_key:evm"),
        Markup.button.callback("🔑 Export SOL Key", "export_private_key:solana"),
    ],
    [
        Markup.button.callback("💸 Withdraw SOL", "withdraw_sol"),
        Markup.button.callback("💵 Withdraw USDC", "withdraw_usdc"),
    ],
    [Markup.button.callback("🔁 Swap USDC to USDCe", "swap_funds")],
    [BRIDGE_BUTTON],
    [Markup.button.callback("🔄️ Reset Wallet", "reset_wallet"), CLOSE_BUTTON],
];

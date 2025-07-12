import { BACK_TO_MAIN_MENU_BUTTON, BRIDGE_BUTTON, CLOSE_BUTTON } from "@/bot/ui/buttons/common";
import { Markup } from "telegraf";

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

export const SUBSCRIPTIONS_MENU_BUTTONS = [
    [
        Markup.button.callback("🔔 Subscribe", "subscriptions:subscribe"),
        Markup.button.callback("🔕 Unsubscribe", "subscriptions:unsubscribe"),
    ],
    [Markup.button.callback("📋 My Subscriptions", "subscriptions:view")],
    [BACK_TO_MAIN_MENU_BUTTON],
];

export const TRADE_MENU_BUTTONS = [
    [Markup.button.callback("🔎 Top Markets", "trade_top_markets_view")],
    [
        Markup.button.callback("⚡ Open Position", "trade_position_open"),
        Markup.button.callback("🌂 Close Position", "trade_position_close"),
    ],
    [BACK_TO_MAIN_MENU_BUTTON],
];

export const AUTO_TRADE_MENU_BUTTONS = [
    [
        Markup.button.callback("➕ Add Wallet", "add_new_wallet"),
        Markup.button.callback("🗑️ Delete Wallet", "delete_wallet"),
    ],
    [
        Markup.button.callback("👁️ View Watched Wallets", "view_watched_wallets"),
        Markup.button.callback("💰 Configure", "copy_trade_configure"),
    ],
    [BACK_TO_MAIN_MENU_BUTTON],
];

export const WALLET_SETTINGS_MENU = [
    [Markup.button.callback("🔑 Export EVM Private Key", "export_private_key:evm")],
    [Markup.button.callback("🔑 Export Solana Private Key", "export_private_key:solana")],
    [Markup.button.callback("🔁 Swap USDC to USDCe", "swap_funds")],
    [BRIDGE_BUTTON],
    [Markup.button.callback("🔄️ Reset Wallet", "reset_wallet")],
    [CLOSE_BUTTON],
];

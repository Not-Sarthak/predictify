import { Markup } from "telegraf";

export const BACK_TO_MAIN_MENU_BUTTON = Markup.button.callback(
    "🔙 Back to Main Menu",
    "back_to_main_menu"
);

export const CLOSE_BUTTON = Markup.button.callback("❌ Close", "close_message");

export const BRIDGE_BUTTON = Markup.button.callback(
    "🚀 Bridge SOL → USDC + Auto POL Acquisition",
    "bridge_funds"
);

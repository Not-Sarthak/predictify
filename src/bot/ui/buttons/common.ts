import { Markup } from "telegraf";
import { getUserLanguage } from "../../../helpers/user-language";
import { t } from "../../../i18n";

// Static buttons for non-user-specific contexts (these should be avoided in favor of translated versions)
export const BACK_TO_MAIN_MENU_BUTTON = Markup.button.callback(
    "🔙 Back to Main Menu",
    "back_to_main_menu"
);

export const CLOSE_BUTTON = Markup.button.callback("❌ Close", "close_message");

export const BRIDGE_BUTTON = Markup.button.callback(
    "🚀 Bridge SOL → USDC + Auto POL Acquisition",
    "bridge_funds"
);

// Translated button generators
export async function getBackToMainMenuButton(userId: number) {
    const language = await getUserLanguage(userId);
    return Markup.button.callback(t("backToMainMenu", language), "back_to_main_menu");
}

export async function getCloseButton(userId: number) {
    const language = await getUserLanguage(userId);
    return Markup.button.callback(t("close", language), "close_message");
}

export async function getBridgeButton(userId: number) {
    const language = await getUserLanguage(userId);
    return Markup.button.callback(t("bridgeSolToUsdc", language), "bridge_funds");
}

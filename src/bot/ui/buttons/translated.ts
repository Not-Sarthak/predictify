import { Markup } from "telegraf";
import { BRIDGE_BUTTON, CLOSE_BUTTON, getBackToMainMenuButton } from "./common";
import { getUserLanguage } from "../../../helpers/user-language";
import { t, type SupportedLanguage } from "../../../i18n";

/**
 * Generate main menu buttons with translations
 */
export function generateTranslatedMainMenuButtons(language: SupportedLanguage) {
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

/**
 * Generate trade menu buttons with translations
 */
export async function generateTranslatedTradeMenuButtons(userId: number) {
    const language = await getUserLanguage(userId);

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

/**
 * Generate view profile menu buttons with translations
 */
export async function generateTranslatedViewProfileButtons(
    userId: number,
    showUsernameInCards: boolean
) {
    const language = await getUserLanguage(userId);

    const toggleButtonTitle = showUsernameInCards
        ? t("hideUsernameInPnLCards", language)
        : t("showUsernameInPnLCards", language);

    const toggleButtonCallbackData = showUsernameInCards
        ? "toggle_show_username:0"
        : "toggle_show_username:1";

    return [
        [Markup.button.callback(toggleButtonTitle, toggleButtonCallbackData)],
        [Markup.button.callback(t("languageSettings", language), "language_settings")],
        [CLOSE_BUTTON],
    ];
}

/**
 * Generate wallet settings menu with translations
 */
export async function generateTranslatedWalletSettingsMenu(userId: number) {
    const language = await getUserLanguage(userId);

    return [
        [
            Markup.button.callback(t("exportEvmKey", language), "export_private_key:evm"),
            Markup.button.callback(t("exportSolKey", language), "export_private_key:solana"),
        ],
        [
            Markup.button.callback(t("withdrawSol", language), "withdraw_sol"),
            Markup.button.callback(t("withdrawUsdc", language), "withdraw_usdc"),
        ],
        [Markup.button.callback(t("swapFunds", language), "swap_funds")],
        [BRIDGE_BUTTON],
        [Markup.button.callback(t("resetWallet", language), "reset_wallet"), CLOSE_BUTTON],
    ];
}

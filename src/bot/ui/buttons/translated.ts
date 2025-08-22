import { Markup } from "telegraf";
import { BACK_TO_MAIN_MENU_BUTTON, BRIDGE_BUTTON, CLOSE_BUTTON } from "./common";
import { getUserLanguage } from "../../../helpers/user-language";
import { t } from "../../../i18n";

/**
 * Generate main menu buttons with translations
 */
export async function generateTranslatedMainMenuButtons(userId: number) {
    const language = await getUserLanguage(userId);

    return [
        [
            Markup.button.callback(t("subscriptions", language), `start:subscriptions`),
            Markup.button.callback(t("trade", language), `start:trade`),
        ],
        [
            Markup.button.callback(t("tradeStrategies", language), `start:strategies`),
            Markup.button.callback(t("autoTrade", language), `start:autotrade`),
        ],
        [
            Markup.button.callback(t("portfolio", language), "trade_position_view"),
            Markup.button.callback(t("walletFunds", language), "settings:wallet"),
        ],
        [
            Markup.button.callback(t("viewProfile", language), "view_profile"),
            Markup.button.callback(t("language", language), "language_settings"),
        ],
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

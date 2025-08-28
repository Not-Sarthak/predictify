import { getUserLanguage } from "../../../helpers/user-language";
import { t, type SupportedLanguage } from "../../../i18n";

/**
 * Generate welcome message with translations
 */
export async function generateTranslatedWelcomeMessage(
    userId: number,
    evm_address: string,
    solana_address: string,
    usdcBalance: string,
    solBalance: number,
    lockedBalance: number,
    polBalance?: number
): Promise<string> {
    const language = await getUserLanguage(userId);

    let balanceSection = `💰 ${t("balances", language)}
• ${t("totalBalance", language)}: $${usdcBalance}
• ${t("availableBalance", language)}: $${Number(usdcBalance) - lockedBalance}
    • ${t("sol", language)}: ${solBalance} ${t("sol", language)}
• ${t("lockedBalance", language)}: $${lockedBalance}`;

    if (polBalance !== undefined) {
        balanceSection += `
• POL: ${polBalance.toFixed(4)} POL`;
        if (polBalance < 5) {
            balanceSection += ` ⚠️ (Low - Auto Acquisition Enabled)`;
        } else {
            balanceSection += ` ✅`;
        }
    }

    return `
${t("welcome", language)}

🔐 ${t("addresses", language)}
• ${t("solanaAddress", language)}: <code>${solana_address}</code>
• ${t("evmAddress", language)}: <code>${evm_address}</code>

${balanceSection}

🔥 ${t("whatYouCanDo", language)}:
• ${t("blastYesNoBets", language)}
• ${t("copyTopWallets", language)}
• ${t("getAlertsByCategory", language)}
• ${t("trackPnlPositions", language)}
• ${t("fundWalletWithSol", language)}

👉 ${t("useFundCommand", language)}
${t("noLoginsBrowserTabs", language)} 🫡
`.trim();
}

/**
 * Generate translated wallet details message
 */
export async function generateTranslatedWalletDetailsMessage(
    userId: number,
    evmWalletAddress: string,
    solanaWalletAddress: string | null,
    usdcBalance: number,
    solBalance: number,
    polBalance?: number
): Promise<string> {
    const language = await getUserLanguage(userId);

    let balanceSection = `
<b>💰 ${t("balances", language)}</b>
<b>💵 USDC:</b> $${usdcBalance.toLocaleString()}
<b>🌟 ${t("sol", language)}:</b> ${solBalance.toFixed(4)} ${t("sol", language)}`;

    if (polBalance !== undefined) {
        balanceSection += `\n<b>⛽ POL:</b> ${polBalance.toFixed(4)} POL`;

        // Add gas fee status
        if (polBalance < 5) {
            balanceSection += ` <b>⚠️ (Low - Auto-acquire available)</b>`;
        } else {
            balanceSection += ` <b>✅ (Sufficient for gas)</b>`;
        }
    }

    return `
<b>💼 Wallet Overview</b>

<b>🔗 ${t("addresses", language)}</b>
<b>EVM:</b> <code>${evmWalletAddress}</code>
<b>${t("solana", language)}:</b> <code>${solanaWalletAddress || "N/A"}</code>

${balanceSection}
`.trim();
}

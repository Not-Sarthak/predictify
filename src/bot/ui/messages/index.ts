import { Context, Markup } from "telegraf";
import { CLOSE_BUTTON, generateAutoTradeMenuButtons } from "../../ui/buttons";
import {
    checkCopyTradeUserStatus,
    checkWalletCopyTradeStatus,
    getUserIdFromCtx,
} from "../../utils";
import { getUserLanguage } from "../../../helpers/user-language";
import { t } from "../../../i18n";
import type { InlineKeyboardMarkup } from "telegraf/types";
import { encodeMarketConditionId } from "../../../utils/encoding";
import { ZERO_DTE_MARKETS_CATEGORY_LIST } from "../../../shared/constants";
import { redisClient } from "../../../lib/redis";
import { getMarketByConditionId } from "../../../utils/polymarket/get-markets";
import { getMessages } from "../../../i18n";

export const generateWelcomeMessage = async (
    evm_address: string,
    solana_address: string,
    usdcBalance: string,
    solBalance: number,
    lockedBalance: number,
    userId: number,
    polBalance?: number
): Promise<string> => {
    const language = await getUserLanguage(userId);

    let balanceSection = `💰 ${t("yourBalances", language)}
• ${t("totalBalance", language)}: $${usdcBalance}
• ${t("availableBalance", language)}: $${Number(usdcBalance) - lockedBalance}
• SOL: ${solBalance} SOL
• ${t("lockedBalance", language)}: $${lockedBalance}`;

    if (polBalance !== undefined) {
        balanceSection += `
• POL: ${polBalance.toFixed(4)} POL`;
        if (polBalance < 5) {
            balanceSection += ` ⚠️ (${t("lowBalance", language)} - ${t("autoAcquisitionEnabled", language)})`;
        } else {
            balanceSection += ` ✅`;
        }
    }

    return `
${t("welcome", language)}

🔐 ${t("yourWallets", language)}
• ${t("solanaAddress", language)}: <code>${solana_address}</code>
• ${t("polygonAddress", language)}: <code>${evm_address}</code>

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
};

export const generateWalletDetailsMessage = async (
    evmWalletAddress: string,
    solanaWalletAddress: string | null,
    usdcBalance: number,
    solBalance: number,
    userId: number,
    polBalance?: number
) => {
    const language = await getUserLanguage(userId);

    let balanceSection = `
<b>💰 ${t("balances", language)}</b>
<b>💵 USDC:</b> $${usdcBalance.toLocaleString()}
<b>🌟 SOL:</b> ${solBalance.toFixed(4)} SOL`;

    if (polBalance !== undefined) {
        balanceSection += `\n<b>⛽ POL:</b> ${polBalance.toFixed(4)} POL`;

        // Add gas fee status
        if (polBalance < 5) {
            balanceSection += ` <b>⚠️ (${t("lowBalance", language)} - Auto-acquire available)</b>`;
        } else {
            balanceSection += ` <b>✅ (Sufficient for gas)</b>`;
        }
    }

    return `
<b>💼 Wallet Overview</b>

<b>🔗 ${t("addresses", language)}</b>
<b>EVM:</b> <code>${evmWalletAddress}</code>
<b>Solana:</b> <code>${solanaWalletAddress || "N/A"}</code>

${balanceSection}
`.trim();
};

export const generateAutoTradeMenu = async (
    ctx: Context
): Promise<{ message: string; replyMarkup: InlineKeyboardMarkup } | undefined> => {
    const userId = getUserIdFromCtx(ctx);
    const language = await getUserLanguage(userId);

    const [walletStatusList, userCopyTradeStatus] = await Promise.all([
        await checkWalletCopyTradeStatus(userId.toString()),
        await checkCopyTradeUserStatus(userId.toString()),
    ]);

    if (!walletStatusList) {
        ctx.reply("No Added Wallets");
        return;
    }

    const watchedWalletsCount = walletStatusList.length;

    const statusMessage =
        `🤖 *${t("autoTradeMenu", language)}*\n\n` +
        `👁️ *${t("monitoring", language)}:* ${watchedWalletsCount}/3 ${t("wallets", language)}\n\n` +
        `${t("selectAction", language)}`;

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

    const autoTradeMenuButtons = await generateAutoTradeMenuButtons(userId);

    const combinedButtons = [
        ...walletButtons,
        [
            Markup.button.callback(
                userCopyTradeStatus
                    ? `❌ ${t("disableCopyTrade", language)}`
                    : `✅ ${t("enableCopyTrade", language)}`,
                `toggle_copy_trade:${!userCopyTradeStatus}`
            ),
        ],
        ...autoTradeMenuButtons,
    ];

    const markup = Markup.inlineKeyboard(combinedButtons).reply_markup;

    return { message: statusMessage, replyMarkup: markup };
};

export async function createRedeemablePaginationKeyboard(
    conditionId: string,
    index: number,
    total: number,
    userId: string
) {
    const language = await getUserLanguage(parseInt(userId));
    const paginationButtons = [];

    if (index > 0) {
        paginationButtons.push(
            Markup.button.callback(`⬅️ ${t("previous", language)}`, `redeem_page:${index - 1}`)
        );
    }
    if (index < total - 1) {
        paginationButtons.push(
            Markup.button.callback(`${t("next", language)} ➡️`, `redeem_page:${index + 1}`)
        );
    }

    const rows = [
        [
            Markup.button.callback(
                t("redeem", language),
                `redeem_position_${encodeMarketConditionId(conditionId)}`
            ),
        ],
        paginationButtons,
        [CLOSE_BUTTON],
    ];

    return Markup.inlineKeyboard(rows).reply_markup;
}
export async function createPaginationKeyboard(
    conditionId: string,
    index: number,
    total: number,
    userId: string,
    outcomeIndex: number
) {
    const language = await getUserLanguage(parseInt(userId));
    const redisKey = `user:tp_sl_watchers:${userId}`;
    const tpSlEntries = await redisClient.hGetAll(redisKey); // Get all fields + values

    let showStopTP = false;
    let showStopSL = false;

    for (const [field, value] of Object.entries(tpSlEntries)) {
        if (field.startsWith(`${conditionId}:`)) {
            try {
                const data = JSON.parse(value);
                if (data.type === "take_profit") showStopTP = true;
                if (data.type === "stop_loss") showStopSL = true;
            } catch (error) {
                console.error("Invalid JSON in Redis for:", field);
                console.error("[ERROR]: ", error);
            }
        }
    }

    const market = await getMarketByConditionId(conditionId);
    const paginationButtons = [];

    if (index > 0) {
        paginationButtons.push(
            Markup.button.callback(`⬅️ ${t("previous", language)}`, `portfolio_page:${index - 1}`)
        );
    }
    if (index < total - 1) {
        paginationButtons.push(
            Markup.button.callback(`${t("next", language)} ➡️`, `portfolio_page:${index + 1}`)
        );
    }

    paginationButtons.push(
        Markup.button.callback(`🔄 ${t("refresh", language)}`, `refresh_portfolio:${index}`)
    );

    const rows = [
        [
            Markup.button.callback(
                t("sellFiftyPercent", language),
                `sell_50_${encodeMarketConditionId(conditionId)}`
            ),
            Markup.button.callback(
                t("sellHundredPercent", language),
                `sell_100_${encodeMarketConditionId(conditionId)}`
            ),
            Markup.button.callback(
                t("sellCustom", language),
                `sell_custom_${encodeMarketConditionId(conditionId)}`
            ),
        ],
        [
            Markup.button.callback(
                t("buyMoreMarket", language),
                `market_order:${market.id}:${outcomeIndex === 0 ? "yes" : "no"}`
            ),
            Markup.button.callback(
                t("buyMoreLimit", language),
                `limit_order:${market.id}:${outcomeIndex === 0 ? "yes" : "no"}`
            ),
        ],
        [
            Markup.button.callback(
                `🔔 ${t("setPriceAlert", language)}`,
                `set_price_alert:${encodeMarketConditionId(conditionId)}`
            ),
            Markup.button.callback(
                `💸 ${t("takeProfit", language)}`,
                `take_profit:${encodeMarketConditionId(conditionId)}`
            ),
            Markup.button.callback(
                `🛑 ${t("stopLoss", language)}`,
                `stop_loss:${encodeMarketConditionId(conditionId)}`
            ),
        ],
        [
            ...(showStopTP
                ? [
                      Markup.button.callback(
                          t("cancelTakeProfit", language),
                          `stop_tp:${encodeMarketConditionId(conditionId)}`
                      ),
                  ]
                : []),
            ...(showStopSL
                ? [
                      Markup.button.callback(
                          t("cancelStopLoss", language),
                          `stop_sl:${encodeMarketConditionId(conditionId)}`
                      ),
                  ]
                : []),
        ],
        paginationButtons,
        [Markup.button.callback(t("generatePortfolioCard", language), "generate_portfolio_card")],
        [CLOSE_BUTTON],
    ];

    return Markup.inlineKeyboard(rows).reply_markup;
}

export async function handleAutoTradeMenu(ctx: Context) {
    const menuResult = await generateAutoTradeMenu(ctx);
    if (!menuResult) return;

    const { message, replyMarkup } = menuResult;

    await ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: replyMarkup,
    });
}

export async function generate0DTEMarketCategoryKeyboard(userId?: number) {
    // If userId is provided, generate translated keyboard
    if (userId) {
        const language = await getUserLanguage(userId);
        const t = getMessages(language);

        const cryptoTranslations: Record<string, string> = {
            Bitcoin: t.bitcoin,
            Ethereum: t.ethereum,
            Solana: t.solana,
            XRP: t.xrp,
            Dogecoin: t.dogecoin,
        };

        const CATEGORY_BUTTONS = ZERO_DTE_MARKETS_CATEGORY_LIST.map((category) =>
            Markup.button.callback(
                cryptoTranslations[category] || category,
                `zero_dte_category:${category.toLowerCase()}`
            )
        );

        const HOURLY_0DTE_MARKET_BUTTON = Markup.button.callback(
            t.hourlyMarkets,
            "view_hourly_0dte_markets"
        );

        const keyboardLayout = [];
        for (let i = 0; i < CATEGORY_BUTTONS.length; i += 3) {
            keyboardLayout.push(CATEGORY_BUTTONS.slice(i, i + 3));
        }

        const keyboard = Markup.inlineKeyboard([
            [HOURLY_0DTE_MARKET_BUTTON],
            ...keyboardLayout,
            [CLOSE_BUTTON],
        ]);

        return keyboard;
    }

    // Default English keyboard for backward compatibility
    const CATEGORY_BUTTONS = ZERO_DTE_MARKETS_CATEGORY_LIST.map((category) =>
        Markup.button.callback(category, `zero_dte_category:${category.toLowerCase()}`)
    );

    const HOURLY_0DTE_MARKET_BUTTON = Markup.button.callback(
        "⚡ Hourly Markets",
        "view_hourly_0dte_markets"
    );

    const keyboardLayout = [];
    for (let i = 0; i < CATEGORY_BUTTONS.length; i += 3) {
        keyboardLayout.push(CATEGORY_BUTTONS.slice(i, i + 3));
    }

    const keyboard = Markup.inlineKeyboard([
        [HOURLY_0DTE_MARKET_BUTTON],
        ...keyboardLayout,
        [CLOSE_BUTTON],
    ]);

    return keyboard;
}

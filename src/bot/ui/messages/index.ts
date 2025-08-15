import { Context, Markup } from "telegraf";
import { AUTO_TRADE_MENU_BUTTONS, CLOSE_BUTTON } from "../../ui/buttons";
import {
    checkCopyTradeUserStatus,
    checkWalletCopyTradeStatus,
    getUserIdFromCtx,
} from "../../utils";
import type { InlineKeyboardMarkup } from "telegraf/types";
import { encodeMarketConditionId } from "../../../utils/encoding";
import { ZERO_DTE_MARKETS_CATEGORY_LIST } from "../../../shared/constants";
import { redisClient } from "../../../lib/redis";
import { getMarketByConditionId } from "../../../utils/polymarket/get-markets";

export const generateWelcomeMessage = (
    evm_address: string,
    solana_address: string,
    usdcBalance: string,
    solBalance: number,
    lockedBalance: number
): string => {
    return `
Welcome to Predictify
We trade headlines for breakfast. 📰⚔
Your wallet’s live. Let’s degen.

🔐 Your Wallets
• Solana Address: <code>${solana_address}</code>
• Polygon Address: <code>${evm_address}</code>

💰 Your Balances
• Total Balance: $${usdcBalance}
• Available Balance: $${Number(usdcBalance) - lockedBalance}
• SOL: ${solBalance} SOL
• Locked Balance: $${lockedBalance}

🔥 What you can do:
• Blast YES/NO bets with market or limit orders
• Copy top wallets instantly
• Get alerts by category — “Elections”, “Crypto”, “AI”
• Track PnL and open positions
• Fund your wallet with SOL or Polygon USDC — your choice

👉 Use /fund to load up and start trading
No logins. No browser tabs. Just pure prediction market flow. 🫡
`.trim();
};

export const generateWalletDetailsMessage = (
    evmWalletAddress: string,
    solanaWalletAddress: string | null,
    usdcBalance: number,
    solBalance: number
) => {
    return `
<b>💼 Wallet Overview</b>

<b>🔗 Addresses</b>
<b>EVM:</b> <code>${evmWalletAddress}</code>
<b>Solana:</b> <code>${solanaWalletAddress || "N/A"}</code>

<b>💰 Balances</b>
<b>💵 USDC:</b> $${usdcBalance.toLocaleString()}
<b>🌟 SOL:</b> ${solBalance.toFixed(4)} SOL
`.trim();
};

export const generateAutoTradeMenu = async (
    ctx: Context
): Promise<{ message: string; replyMarkup: InlineKeyboardMarkup } | undefined> => {
    const userId = getUserIdFromCtx(ctx);

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
        `🤖 *AutoTrade Menu*\n\n` +
        `👁️ *Monitoring:* ${watchedWalletsCount}/3 Wallets\n\n` +
        `Select an Action:`;

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

    const combinedButtons = [
        ...walletButtons,
        [
            Markup.button.callback(
                userCopyTradeStatus ? "❌ Disable CopyTrade" : "✅ Enable CopyTrade",
                `toggle_copy_trade:${!userCopyTradeStatus}`
            ),
        ],
        ...AUTO_TRADE_MENU_BUTTONS,
    ];

    const markup = Markup.inlineKeyboard(combinedButtons).reply_markup;

    return { message: statusMessage, replyMarkup: markup };
};

export async function createPaginationKeyboard(
    conditionId: string,
    index: number,
    total: number,
    userId: string,
    outcomeIndex: number
) {
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
        paginationButtons.push(Markup.button.callback("⬅️ Prev", `portfolio_page:${index - 1}`));
    }
    if (index < total - 1) {
        paginationButtons.push(Markup.button.callback("Next ➡️", `portfolio_page:${index + 1}`));
    }

    paginationButtons.push(Markup.button.callback("🔄 Refresh", `refresh_portfolio:${index}`));

    const rows = [
        [
            Markup.button.callback("Sell 50%", `sell_50_${encodeMarketConditionId(conditionId)}`),
            Markup.button.callback("Sell 100%", `sell_100_${encodeMarketConditionId(conditionId)}`),
            Markup.button.callback(
                "Sell Custom",
                `sell_custom_${encodeMarketConditionId(conditionId)}`
            ),
        ],
        [
            Markup.button.callback(
                "Buy More Market",
                `market_order:${market.id}:${outcomeIndex === 0 ? "yes" : "no"}`
            ),
            Markup.button.callback(
                "Buy More Limit",
                `limit_order:${market.id}:${outcomeIndex === 0 ? "yes" : "no"}`
            ),
        ],
        [
            Markup.button.callback(
                "🔔 Set Price Alert",
                `set_price_alert:${encodeMarketConditionId(conditionId)}`
            ),
            Markup.button.callback(
                "💸 Take Profit",
                `take_profit:${encodeMarketConditionId(conditionId)}`
            ),
            Markup.button.callback(
                "🛑 Stop Loss",
                `stop_loss:${encodeMarketConditionId(conditionId)}`
            ),
        ],
        [
            ...(showStopTP
                ? [
                      Markup.button.callback(
                          "❌ Cancel Take Profit",
                          `stop_tp:${encodeMarketConditionId(conditionId)}`
                      ),
                  ]
                : []),
            ...(showStopSL
                ? [
                      Markup.button.callback(
                          "❌ Cancel Stop Loss",
                          `stop_sl:${encodeMarketConditionId(conditionId)}`
                      ),
                  ]
                : []),
        ],
        paginationButtons,
        [Markup.button.callback("⚡ Generate Portfolio Card", "generate_portfolio_card")],
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

export async function generate0DTEMarketCategoryKeyboard() {
    const CATEGORY_BUTTONS = ZERO_DTE_MARKETS_CATEGORY_LIST.map((category) =>
        Markup.button.callback(category, `zero_dte_category:${category.toLowerCase()}`)
    );

    const keyboardLayout = [];
    for (let i = 0; i < CATEGORY_BUTTONS.length; i += 3) {
        keyboardLayout.push(CATEGORY_BUTTONS.slice(i, i + 3));
    }

    const keyboard = Markup.inlineKeyboard(keyboardLayout);

    return keyboard;
}

import { generateTradeButtons } from "@/bot/ui/buttons/trade";
import { truncate } from "@/utils/truncate";
import type { MarketData } from "@/types/polymarket/market-data";
import { Context, Markup } from "telegraf";
import { AUTO_TRADE_MENU_BUTTONS } from "@/bot/ui/buttons";
import {
    checkCopyTradeUserStatus,
    checkWalletCopyTradeStatus,
    getUserIdFromCtx,
} from "@/bot/utils";
import type { InlineKeyboardMarkup } from "telegraf/types";

export const generateWelcomeMessage = (
    evm_address: string,
    solana_address: string,
    usdcBalance: string,
    solBalance: number,
    apiCreds: { key: string; secret: string; passphrase: string }
): string => {
    return `
Welcome back to Polymarket Bot!

🔐 Your New Wallet:
EVM Address: <code>${evm_address || "N/A"}</code>
Solana Address: <code>${solana_address || "N/A"}</code>

💵 USDC Balance: ${usdcBalance} USDC
🌟 SOL Balance: ${solBalance.toFixed(4)} SOL

🔑 Credentials:
Key: <code>${apiCreds.key || "N/A"}</code>
Secret: <code>${apiCreds.secret || "N/A"}</code>
Passphrase: <code>${apiCreds.passphrase || "N/A"}</code>

How to use:
1. 📢 Set Alerts for Market Categories
2. ⚡ Open a Position in Just 2 Clicks
3. 🤖 AutoTrade (Copytrading)
`.trim();
};

export const generateSubscribedMessage = (category: string) => `🔔 Subscribed to ${category}`;

export const generateUnsubscribedMessage = (category: string) => `🔕 Unsubscribed from ${category}`;

export const generateActiveSubscriptionsMessage = (categories: string[]) =>
    `You're Subscribed To:\n• ${categories.join("\n• ")}`;

export const generateNotificationMessage = (market: MarketData, category: string) => {
    const message = `

<b>🆕 ${truncate(market.question, 200)}</b>
    
<b>📝 Description</b>
${truncate(market.description, 500)}

<b>📂 Category:</b> ${category}
<b>🕒 Start:</b> ${new Date(market.startDate).toLocaleString()}
<b>⏳ End:</b> ${new Date(market.endDate).toLocaleString()}
<b>💧 Liquidity:</b> $${(market.liquidity || 0).toLocaleString()}
<b>📊 Volume (24h):</b> $${(market.volume || 0).toLocaleString()}

<a href="https://polymarket.com/event/${encodeURIComponent(market.slug)}">🔗 View Full Market</a>
    `.trim();

    const keyboard = Markup.inlineKeyboard(generateTradeButtons(market.id)).reply_markup;

    return { message, keyboard };
};

export const generateWalletDetailsMessage = (
    evmWalletAddress: string,
    solanaWalletAddress: string | null,
    usdcBalance: number,
    solBalance: number,
    totalBalance: number
) => {
    return `
<b>💼 Wallet Overview</b>

<b>🔗 Addresses</b>
<b>EVM:</b> <code>${evmWalletAddress}</code>
<b>Solana:</b> <code>${solanaWalletAddress || "N/A"}</code>

<b>💰 Balances</b>
<b>💵 USDC:</b> $${usdcBalance.toLocaleString()}
<b>🌟 SOL:</b> ${solBalance.toFixed(4)} SOL
<b>📊 Total:</b> $${totalBalance.toLocaleString()}
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

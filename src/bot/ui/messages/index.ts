// TODO:FIX - UPDATE IMPORTS (NAMES HAVE BEEN CHANGED)

import { generateTradeButtons } from "@/bot/ui/buttons/trade";
import { truncate } from "@/shared/utils/truncate";
import type { MarketData } from "@/shared/types/polymarket/market-data";
import { Markup } from "telegraf";

// Message Functions
export const generateWelcomeMessage = (
    evm_address: string,
    solana_address: string,
    balance: string,
    apiCreds: { key: string; secret: string; passphrase: string }
): string => {
    return `
Welcome back to Polymarket Bot!

🔐 Your New Wallet:
EVM Address: <code>${evm_address}</code>
Solana Address: <code>${solana_address || "N/A"}</code>

Balance: ${balance} USDC

🔑 Credentials:
Key: <code>${apiCreds.key}</code>
Secret: <code>${apiCreds.secret}</code>
Passphrase: <code>${apiCreds.passphrase}</code>

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
    totalBalance: number
) => {
    return (
        `🔑 <b>Your EVM Wallet Address:</b>\n<code>${evmWalletAddress}</code>\n\n` +
        `🔑 <b>Your Solana Wallet Address:</b>\n<code>${solanaWalletAddress || "N/A"}</code>\n\n` +
        `💵 <b>USDC Balance:</b> $${usdcBalance}\n` +
        `💰 <b>Total Balance (All tokens):</b> $${totalBalance}`
    );
};

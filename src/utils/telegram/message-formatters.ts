import type { UserPositionResponse } from "../../types/user-position";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatWelcomeMessage(
  address: string,
  balance: string,
  apiCreds: { key: string; secret: string; passphrase: string }
): string {
  return `
Welcome back to Polymarket Bot!

🔐 Your New Wallet:
Address: <code>${address}</code>
Balance: ${balance} USDC

🔑 API Credentials:
Key: <code>${apiCreds.key}</code>
Secret: <code>${apiCreds.secret}</code>
Passphrase: <code>${apiCreds.passphrase}</code>

How to use:
1. 📢 Set Alerts for Market Categories
2. ⚡ Open a Position in Just 2 Clicks
3. 🤖 AutoTrade (Copytrading)
`.trim();
}

export function formatActiveSubscriptionsMessage(categories: string[]): string {
  return `You're Subscribed To:\n• ${categories.join("\n• ")}`;
}

export function formatCurrentTradePositionsMessage(
  userPositions: UserPositionResponse[]
) {
  const userPositionsMessages: string[] = [];

  for (const position of userPositions) {
    const {
      title,
      outcome,
      size,
      avgPrice,
      curPrice,
      currentValue,
      cashPnl,
      percentPnl,
      endDate,
      slug,
    } = position;

    const isProfit = cashPnl > 0;
    const pnlEmoji = isProfit ? "📈" : "📉";
    const outcomeEmoji = outcome === "Yes" ? "🟢" : "🔴";

    const message = `📊 *${title}*
${outcomeEmoji} ${outcome} | ${size} shares @ ${avgPrice.toFixed(
      4
    )} → ${curPrice.toFixed(4)}
💼 Value: ${currentValue.toFixed(4)} USDC | ${pnlEmoji} PnL: ${cashPnl.toFixed(
      2
    )} (${percentPnl.toFixed(1)}%)

📆 Ends: ${formatDate(endDate)}
🔗 [View Market](https://polymarket.com/market/${slug})`;

    userPositionsMessages.push(message);
  }

  return userPositionsMessages;
}

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
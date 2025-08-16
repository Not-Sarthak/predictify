import { Context } from "telegraf";
import { runQuickTest } from "../../utils/test-pol-feature";
import { getUserDetails } from "../../helpers/get-user-details";
import { getUserIdFromCtx } from "../utils/get-user-id-ctx";

/**
 * Test command for POL auto-acquisition feature
 * Usage: /test_pol
 */
export async function handleTestPOL(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);

    // Check if user is admin (you can modify this check)
    const adminUsers = [1869143890, 1356285097, 6246225927, 5876455930]; // From your admin list
    if (!adminUsers.includes(userId)) {
        return ctx.reply("❌ This command is only available for administrators.");
    }

    try {
        await ctx.reply("🧪 Running POL auto-acquisition tests...");

        // Get user's wallet address for testing
        const user = await getUserDetails(userId);
        const walletAddress = user?.wallet_address;

        if (!walletAddress) {
            return ctx.reply("❌ No wallet address found. Please set up your wallet first.");
        }

        // Run the test
        console.log("Running POL feature test for user:", userId);
        const result = await runQuickTest(walletAddress);

        if (result) {
            const message = `✅ **POL Feature Test Results**

**Wallet:** \`${walletAddress}\`
**POL Balance:** ${result.polBalance.toFixed(4)} POL
**Needs Auto-Acquisition:** ${result.needsPOL ? "YES ⚠️" : "NO ✅"}
**SOL Price:** $${result.solPrice.toFixed(2)}
**POL Price:** $${result.polPrice.toFixed(4)}

**Bridge Strategy:** ${result.needsPOL ? "Dual Bridge (POL + USDC)" : "Standard Bridge (USDC Only)"}

${
    result.needsPOL
        ? `**Allocation for 10 SOL:**
• POL: ${result.allocation.polAllocation.toFixed(4)} SOL
• USDC: ${result.allocation.usdcAllocation.toFixed(4)} SOL`
        : ""
}

All systems working correctly! 🎉`;

            await ctx.reply(message, { parse_mode: "Markdown" });
        } else {
            await ctx.reply("❌ Test failed. Check logs for details.");
        }
    } catch (error) {
        console.error("Error in POL test command:", error);
        await ctx.reply("❌ Test failed with error. Check logs for details.");
    }
}

/**
 * Quick price check command
 * Usage: /check_prices
 */
export async function handleCheckPrices(ctx: Context) {
    try {
        await ctx.reply("📈 Checking current prices...");

        const { getSOLPriceUSD, getPOLPriceUSD } = await import("../../utils/crypto-prices");

        const [solPrice, polPrice] = await Promise.all([getSOLPriceUSD(), getPOLPriceUSD()]);

        const message = `📊 **Current Prices**

**SOL:** $${solPrice.toFixed(2)}
**POL:** $${polPrice.toFixed(4)}

**POL Acquisition Cost:**
• $1 worth of POL = ${(1 / polPrice).toFixed(4)} POL
• In SOL = ${(1 / solPrice).toFixed(6)} SOL

*Prices from CoinGecko API*`;

        await ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
        console.error("Error in price check command:", error);
        await ctx.reply("❌ Failed to fetch prices. Check logs for details.");
    }
}

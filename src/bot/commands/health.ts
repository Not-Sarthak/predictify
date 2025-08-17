import type { Context } from "telegraf";
import { getUserIdFromCtx } from "../utils";
import { testDatabaseConnectivity } from "../../utils/database-health";

/**
 * Debug command to test database connectivity
 * Useful for troubleshooting regional connectivity issues
 */
export async function handleHealthCommand(ctx: Context) {
    try {
        const userId = getUserIdFromCtx(ctx);

        await ctx.reply(
            "🔍 **Testing Database Connectivity...**\n\nThis may take a few moments...",
            {
                parse_mode: "Markdown",
            }
        );

        const result = await testDatabaseConnectivity();

        if (result.success) {
            await ctx.reply(
                `✅ **Database Connection: SUCCESS**\n\n` +
                    `📊 **Connection Details:**\n` +
                    `• Latency: ${result.latency}ms\n` +
                    `• Retries needed: ${result.retries || 0}\n` +
                    `• Status: All systems operational\n\n` +
                    `Your referral stats should work normally. If you're still experiencing issues, ` +
                    `try refreshing or wait a few moments before trying again.`,
                { parse_mode: "Markdown" }
            );
        } else {
            await ctx.reply(
                `❌ **Database Connection: FAILED**\n\n` +
                    `🔍 **Diagnostics:**\n` +
                    `• Error: ${result.error}\n` +
                    `• Retries attempted: ${result.retries || 0}\n\n` +
                    `**Possible solutions:**\n` +
                    `• Check your internet connection\n` +
                    `• Try using a VPN if you're in a restricted region\n` +
                    `• Wait a few minutes and try again\n` +
                    `• Contact support if the issue persists\n\n` +
                    `**Note:** Other bot features may still work normally.`,
                { parse_mode: "Markdown" }
            );
        }
    } catch (error) {
        console.error("Error in health command:", error);
        await ctx.reply(
            "⚠️ **Health Check Failed**\n\n" +
                "Unable to perform connectivity test. This indicates a severe connectivity issue.\n\n" +
                "**Try:**\n" +
                "• Checking your internet connection\n" +
                "• Using a VPN if you're in a region with restrictions\n" +
                "• Trying again later",
            { parse_mode: "Markdown" }
        );
    }
}

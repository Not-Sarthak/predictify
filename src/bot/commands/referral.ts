import { Markup, type Context } from "telegraf";
import { getUserIdFromCtx } from "../utils";
import { getReferralStats } from "../../utils/referral/referral-tracker";

export async function handleRefCommand(ctx: Context) {
    try {
        const userId = getUserIdFromCtx(ctx);

        const botInfo = await ctx.telegram.getMe();
        const botUsername = botInfo.username;
        const language = await (async () => {
            try {
                return (
                    (ctx.from &&
                        (await import("../../helpers/user-language").then((m) =>
                            m.getUserLanguage(ctx.from!.id)
                        ))) ||
                    "en"
                );
            } catch {
                return "en";
            }
        })();
        const messages = (await import("../../i18n/translate")).getMessages(language as any);

        const stats = await getReferralStats(userId, botUsername);

        // Check if we got fallback data (indicates an error occurred)
        if (stats.referralLink === "N/A") {
            await ctx.reply(
                "⚠️ **Connection Issue Detected**\n\n" +
                    "We're experiencing connectivity issues fetching your referral stats. " +
                    "This might be due to your network connection or regional restrictions.\n\n" +
                    "**What you can try:**\n" +
                    "• Wait a few moments and try again\n" +
                    "• Check your internet connection\n" +
                    "• Try using a VPN if you're in a restricted region\n\n" +
                    "All other bot features should work normally. We're working to improve connectivity for all regions.",
                {
                    parse_mode: "Markdown",
                    reply_markup: Markup.inlineKeyboard([
                        [Markup.button.callback(messages.refresh, "referral:refresh")],
                        [Markup.button.callback("🔙 Main Menu", "main_menu")],
                    ]).reply_markup,
                }
            );
            return;
        }

        let message = `🎯 **Referral Dashboard**\n\n`;

        // Overview stats
        message += `📊 **Overview:**\n`;
        message += `• Total Referred Users: **${stats.totalReferred}**\n`;
        message += `• Total Earnings: **$${stats.totalEarnings.toFixed(4)}**\n`;
        message += `• Your Referral Link: \`${stats.referralLink}\`\n\n`;

        // How it works
        message += `💡 **How Referrals Work:**\n`;
        message += `• Share your referral link with friends\n`;
        message += `• When someone clicks it, they're automatically linked to you\n`;
        message += `• You earn **25%** of treasury fees from their trades\n`;
        message += `• No limits - the more they trade, the more you earn!\n\n`;

        // Referred users section
        if (stats.referredUsers.length > 0) {
            message += `👥 **Your Referred Users:**\n`;
            stats.referredUsers.slice(0, 10).forEach((user, index) => {
                message += `${index + 1}. @${user.username}\n`;
                message += `   • Joined: ${user.joinDate}\n`;
                message += `   • Total Volume: $${user.totalVolume.toFixed(2)}\n\n`;
            });

            if (stats.referredUsers.length > 10) {
                message += `... and **${stats.referredUsers.length - 10}** more users!\n\n`;
            }
        } else {
            message += `👥 **Your Referred Users:**\nNo users referred yet. Start sharing your link!\n\n`;
        }

        message += `🚀 **Start Earning:**\n`;
        message += `1. Copy your link: \`${stats.referralLink}\`\n`;
        message += `2. Share it with friends on social media\n`;
        message += `3. Earn 25% of their trading fees forever!\n\n`;
        message += `💰 **Tip:** Active traders can generate $10-100+ in fees daily!`;

        const keyboard = Markup.inlineKeyboard([
            [
                Markup.button.url(
                    "📱 Share Your Link",
                    `https://t.me/share/url?url=${encodeURIComponent(stats.referralLink)}&text=${encodeURIComponent("Join me on this prediction market trading bot! 🎯📈")}`
                ),
            ],
            [
                Markup.button.callback(
                    messages.refreshStats || `${messages.refresh} Stats`,
                    "referral:refresh"
                ),
                Markup.button.callback("🔙 Main Menu", "main_menu"),
            ],
        ]);

        await ctx.reply(message, {
            parse_mode: "Markdown",
            reply_markup: keyboard.reply_markup,
        });
    } catch (error) {
        console.error("Error in ref command:", error);

        // Enhanced error message with troubleshooting tips
        await ctx.reply(
            "❌ **Error fetching referral stats**\n\n" +
                "We're having trouble connecting to our database. This might be due to:\n" +
                "• Temporary network issues\n" +
                "• Regional connectivity restrictions\n" +
                "• High server load\n\n" +
                "**Please try again in a few moments.** If the issue persists, all other bot features should work normally.",
            {
                parse_mode: "Markdown",
                reply_markup: Markup.inlineKeyboard([
                    [Markup.button.callback("🔄 Try Again", "referral:refresh")],
                    [Markup.button.callback("🔙 Main Menu", "main_menu")],
                ]).reply_markup,
            }
        );
    }
}

export async function handleRefreshReferralStats(ctx: Context) {
    try {
        const language =
            (ctx.from &&
                (await import("../../helpers/user-language").then((m) =>
                    m.getUserLanguage(ctx.from!.id)
                ))) ||
            "en";
        await ctx.answerCbQuery(
            (await import("../../i18n/translate")).getMessages(language as any).refresh ||
                "🔄 Refreshing..."
        );

        if (ctx.callbackQuery && "message" in ctx.callbackQuery && ctx.callbackQuery.message) {
            await ctx.deleteMessage();
        }

        await handleRefCommand(ctx);
    } catch (error) {
        console.error("Error refreshing referral stats:", error);
        await ctx.answerCbQuery("⚠️ Connection issue - please try again");

        // Send a helpful message if deletion/refresh failed
        try {
            await ctx.reply(
                "⚠️ **Unable to refresh at the moment**\n\n" +
                    "This might be due to connectivity issues. Please:\n" +
                    "• Check your internet connection\n" +
                    "• Try again in a few moments\n" +
                    "• Use the main referral command: /ref",
                {
                    parse_mode: "Markdown",
                    reply_markup: Markup.inlineKeyboard([
                        [Markup.button.callback("🔄 Try Again", "referral:refresh")],
                        [Markup.button.callback("🔙 Main Menu", "main_menu")],
                    ]).reply_markup,
                }
            );
        } catch (replyError) {
            console.error("Failed to send error message:", replyError);
        }
    }
}

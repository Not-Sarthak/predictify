import { Markup, type Context } from "telegraf";
import { getUserIdFromCtx } from "../utils";
import { getReferralStats } from "../../utils/referral/referral-tracker";

export async function handleRefCommand(ctx: Context) {
    try {
        const userId = getUserIdFromCtx(ctx);

        const botInfo = await ctx.telegram.getMe();
        const botUsername = botInfo.username;

        const stats = await getReferralStats(userId, botUsername);

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
                Markup.button.callback("🔄 Refresh Stats", "referral:refresh"),
                Markup.button.callback("🔙 Main Menu", "main_menu"),
            ],
        ]);

        await ctx.reply(message, {
            parse_mode: "Markdown",
            reply_markup: keyboard.reply_markup,
        });
    } catch (error) {
        console.error("Error in ref command:", error);
        await ctx.reply("❌ Error fetching referral stats. Please try again later.");
    }
}

export async function handleRefreshReferralStats(ctx: Context) {
    try {
        await ctx.answerCbQuery("🔄 Refreshing...");

        if (ctx.callbackQuery && "message" in ctx.callbackQuery && ctx.callbackQuery.message) {
            await ctx.deleteMessage();
        }

        await handleRefCommand(ctx);
    } catch (error) {
        console.error("Error refreshing referral stats:", error);
        await ctx.answerCbQuery("❌ Error refreshing stats");
    }
}

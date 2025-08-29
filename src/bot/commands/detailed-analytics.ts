import type { Context } from "telegraf";
import { getUserIdFromCtx } from "../utils";
import { ADMIN_USERS_ID } from "../../shared/constants/misc";
import {
    getCurrentWeekActiveUsers,
    getCurrentMonthActiveUsers,
    getWeeklyActiveUserTrends,
    getMonthlyActiveUserTrends,
    getUserActivitySummary,
} from "../../utils/active-user-analytics";
import {
    getUserEngagementStats,
    getRecentActivitySummary,
} from "../../utils/user-engagement-stats";

const formatNumber = (num: number | null | undefined, fractionDigits = 2) => {
    if (num == null) return "0";
    return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: fractionDigits,
    }).format(num);
};

/**
 * Detailed analytics command for deep-dive statistics
 */
export async function handleDetailedAnalytics(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);
    if (!ADMIN_USERS_ID.includes(userId)) return;

    try {
        // Get comprehensive data
        const [weeklyTrends, monthlyTrends, engagementStats, activitySummary] = await Promise.all([
            getWeeklyActiveUserTrends(8).catch(() => []), // Last 8 weeks
            getMonthlyActiveUserTrends(6).catch(() => []), // Last 6 months
            getUserEngagementStats().catch(() => null),
            getRecentActivitySummary().catch(() => null),
        ]);

        let message = `📈 *Detailed Analytics Dashboard*\n\n`;

        // Weekly detailed trends
        if (weeklyTrends.length > 0) {
            message += `**📊 Weekly Activity Analysis (Last 8 Weeks)**\n`;
            weeklyTrends.forEach((week, index) => {
                const weekStart = new Date(week.week_start);
                const weekStr = weekStart.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                });

                const avgTxsPerUser =
                    week.active_users > 0 ? week.total_transactions / week.active_users : 0;
                const isRecent = index >= weeklyTrends.length - 2;
                const prefix = isRecent ? "🔥" : "📊";

                message += `${prefix} W${week.week_number} (${weekStr}): ${formatNumber(week.active_users, 0)} users, ${formatNumber(week.total_transactions, 0)} txns\n`;
                message += `   📈 Avg ${formatNumber(avgTxsPerUser, 1)} txns/user\n`;

                // Calculate week-over-week growth
                if (index > 0) {
                    const prevWeek = weeklyTrends[index - 1];
                    const userGrowth = week.active_users - prevWeek.active_users;
                    const txGrowth = week.total_transactions - prevWeek.total_transactions;
                    const userGrowthPercent =
                        prevWeek.active_users > 0 ? (userGrowth / prevWeek.active_users) * 100 : 0;

                    const userEmoji = userGrowth >= 0 ? "📈" : "📉";
                    const txEmoji = txGrowth >= 0 ? "📈" : "📉";

                    message += `   ${userEmoji} Users: ${userGrowth > 0 ? "+" : ""}${formatNumber(userGrowth, 0)} (${userGrowth > 0 ? "+" : ""}${formatNumber(userGrowthPercent, 1)}%)\n`;
                    message += `   ${txEmoji} TXs: ${txGrowth > 0 ? "+" : ""}${formatNumber(txGrowth, 0)}\n`;
                }
                message += "\n";
            });
        }

        // Monthly detailed trends
        if (monthlyTrends.length > 0) {
            message += `**📅 Monthly Activity Analysis**\n`;
            monthlyTrends.forEach((month, index) => {
                const monthStart = new Date(month.month_start);
                const monthStr = monthStart.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                });

                const avgTxsPerUser =
                    month.active_users > 0 ? month.total_transactions / month.active_users : 0;
                const isRecent = index >= monthlyTrends.length - 1;
                const prefix = isRecent ? "🔥" : "📊";

                message += `${prefix} ${monthStr}: ${formatNumber(month.active_users, 0)} users, ${formatNumber(month.total_transactions, 0)} txns\n`;
                message += `   📈 Avg ${formatNumber(avgTxsPerUser, 1)} txns/user\n`;

                // Calculate month-over-month growth
                if (index > 0) {
                    const prevMonth = monthlyTrends[index - 1];
                    const userGrowth = month.active_users - prevMonth.active_users;
                    const txGrowth = month.total_transactions - prevMonth.total_transactions;
                    const userGrowthPercent =
                        prevMonth.active_users > 0
                            ? (userGrowth / prevMonth.active_users) * 100
                            : 0;

                    const userEmoji = userGrowth >= 0 ? "📈" : "📉";
                    const txEmoji = txGrowth >= 0 ? "📈" : "📉";

                    message += `   ${userEmoji} Users: ${userGrowth > 0 ? "+" : ""}${formatNumber(userGrowth, 0)} (${userGrowth > 0 ? "+" : ""}${formatNumber(userGrowthPercent, 1)}%)\n`;
                    message += `   ${txEmoji} TXs: ${txGrowth > 0 ? "+" : ""}${formatNumber(txGrowth, 0)}\n`;
                }
                message += "\n";
            });
        }

        // Detailed user segments
        if (engagementStats) {
            message += `**👥 User Segment Deep Dive**\n`;
            message += `📊 Total Users: ${formatNumber(engagementStats.totalUsers, 0)}\n`;
            message += `🔸 Active (>0 TXs): ${formatNumber(engagementStats.activeUsers, 0)} (${formatNumber(engagementStats.activeUserRate, 1)}%)\n`;
            message += `🔸 High Volume ($1K+): ${formatNumber(engagementStats.highVolumeUsers, 0)} (${formatNumber(engagementStats.highVolumeRate, 1)}%)\n`;
            message += `🔸 Super Active (10+ TXs): ${formatNumber(engagementStats.superActiveUsers, 0)}\n`;
            message += `🔸 Whales ($10K+): ${formatNumber(engagementStats.whaleUsers, 0)} (${formatNumber(engagementStats.whaleRate, 1)}%)\n\n`;

            message += `**💰 Volume Analysis**\n`;
            message += `🔸 Total Platform Volume: $${formatNumber(engagementStats.totalVolume)}\n`;
            message += `🔸 Avg Volume (Active Users): $${formatNumber(engagementStats.avgVolumeActive)}\n`;
            message += `🔸 Avg Volume (Whales): $${formatNumber(engagementStats.avgVolumeWhale)}\n\n`;

            message += `**📈 Growth Metrics**\n`;
            message += `🔸 New Users (30d): ${formatNumber(engagementStats.recentUsers, 0)}\n`;
            message += `🔸 Very Recent (7d): ${formatNumber(engagementStats.veryRecentUsers, 0)}\n`;

            // Calculate acquisition rates
            const dailyAcquisition = engagementStats.veryRecentUsers / 7;
            const weeklyAcquisition = engagementStats.recentUsers / 4.3; // ~4.3 weeks in 30 days
            message += `🔸 Daily Acquisition Rate: ~${formatNumber(dailyAcquisition, 1)} users/day\n`;
            message += `🔸 Weekly Acquisition Rate: ~${formatNumber(weeklyAcquisition, 1)} users/week\n\n`;
        }

        // Copy trading performance breakdown
        if (activitySummary) {
            message += `**🤖 Copy Trading Performance Analysis**\n`;
            message += `📊 Last 24 Hours:\n`;
            message += `   • Total Trades: ${formatNumber(activitySummary.last24Hours.totalTrades, 0)}\n`;
            message += `   • Success Rate: ${formatNumber(activitySummary.last24Hours.successRate, 1)}%\n`;
            message += `   • Successful: ${formatNumber(activitySummary.last24Hours.successful, 0)} | Failed: ${formatNumber(activitySummary.last24Hours.failed, 0)}\n\n`;

            message += `📊 Last 7 Days:\n`;
            message += `   • Total Trades: ${formatNumber(activitySummary.last7Days.totalTrades, 0)}\n`;
            message += `   • Success Rate: ${formatNumber(activitySummary.last7Days.successRate, 1)}%\n`;
            message += `   • Successful: ${formatNumber(activitySummary.last7Days.successful, 0)} | Failed: ${formatNumber(activitySummary.last7Days.failed, 0)}\n`;

            // Calculate daily averages
            const avgDaily = activitySummary.last7Days.totalTrades / 7;
            message += `   • Avg Daily Trades: ${formatNumber(avgDaily, 1)}\n\n`;
        }

        // Performance insights

        await ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
        console.error("Error in detailed analytics:", error);
        await ctx.reply("❌ Failed to fetch detailed analytics. Please try again later.");
    }
}

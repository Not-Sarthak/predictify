import type { Context } from "telegraf";
import { getUserIdFromCtx } from "../utils";
import { ADMIN_USERS_ID } from "../../shared/constants/misc";
import { db } from "../../lib/supabase";
import {
    getCurrentWeekActiveUsers,
    getCurrentMonthActiveUsers,
    getWeeklyActiveUserTrends,
    getMonthlyActiveUserTrends,
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

export async function handleBotStatistics(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);
    if (!ADMIN_USERS_ID.includes(userId)) return;

    try {
        // Fetch basic user statistics
        const {
            data: users,
            error,
            count,
        } = await db("Users").select("total_volume, markets_traded, txns_executed", {
            count: "exact",
        });

        if (error || !users) {
            console.error(error);
            return ctx.reply("❌ Failed to fetch statistics.");
        }

        // Fetch active user data and engagement stats
        const [
            currentWeekActive,
            currentMonthActive,
            weeklyTrends,
            monthlyTrends,
            engagementStats,
            activitySummary,
        ] = await Promise.all([
            getCurrentWeekActiveUsers().catch(() => 0),
            getCurrentMonthActiveUsers().catch(() => 0),
            getWeeklyActiveUserTrends(4).catch(() => []), // Last 4 weeks
            getMonthlyActiveUserTrends(3).catch(() => []), // Last 3 months
            getUserEngagementStats().catch(() => null),
            getRecentActivitySummary().catch(() => null),
        ]);

        // Calculate basic stats
        const totalUsers = count || 0;
        const totalVolume = users.reduce((sum, u) => sum + (u.total_volume ?? 0), 0);
        const totalMarketsTraded = users.reduce((sum, u) => sum + (u.markets_traded ?? 0), 0);
        const totalTxsExecuted = users.reduce((sum, u) => sum + (u.txns_executed ?? 0), 0);

        // Calculate averages per user
        const avgVolumePerUser = totalUsers > 0 ? totalVolume / totalUsers : 0;
        const avgMarketsPerUser = totalUsers > 0 ? totalMarketsTraded / totalUsers : 0;
        const avgTxsPerUser = totalUsers > 0 ? totalTxsExecuted / totalUsers : 0;

        // Calculate weekly activity rate
        const weeklyActivityRate = totalUsers > 0 ? (currentWeekActive / totalUsers) * 100 : 0;
        const monthlyActivityRate = totalUsers > 0 ? (currentMonthActive / totalUsers) * 100 : 0;

        let message = `📊 *Comprehensive Bot Statistics*\n\n`;

        // Basic Statistics
        message += `**� Overall Metrics**\n`;
        message += `�👥 Total Users: ${formatNumber(totalUsers, 0)}\n`;
        message += `💰 Total Volume: $${formatNumber(totalVolume)}\n`;
        message += `📈 Total Markets Traded: ${formatNumber(totalMarketsTraded, 0)}\n`;
        message += `📝 Total TXs Executed: ${formatNumber(totalTxsExecuted, 0)}\n\n`;

        // Average Statistics
        message += `**📊 Per User Averages**\n`;
        message += `💰 Avg Volume: $${formatNumber(avgVolumePerUser)}\n`;
        message += `📈 Avg Markets: ${formatNumber(avgMarketsPerUser, 1)}\n`;
        message += `📝 Avg TXs: ${formatNumber(avgTxsPerUser, 1)}\n\n`;

        // Active User Statistics
        message += `**🔥 Active User Analytics**\n`;
        message += `📅 This Week: ${formatNumber(currentWeekActive, 0)} users (${formatNumber(weeklyActivityRate, 1)}%)\n`;
        message += `📅 This Month: ${formatNumber(currentMonthActive, 0)} users (${formatNumber(monthlyActivityRate, 1)}%)\n\n`;

        // Weekly Trends
        message += `**📈 Weekly Activity Trends**\n`;
        if (weeklyTrends.length > 0) {
            const recentWeeks = weeklyTrends.slice(-3); // Last 3 weeks
            recentWeeks.forEach((week, index) => {
                const weekStart = new Date(week.week_start);
                const weekStr = weekStart.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                });
                const isCurrentWeek = index === recentWeeks.length - 1;
                const prefix = isCurrentWeek ? "🔥" : "📊";
                message += `${prefix} Week ${week.week_number} (${weekStr}): ${formatNumber(week.active_users, 0)} users, ${formatNumber(week.total_transactions, 0)} txns\n`;
            });

            // Calculate weekly growth
            if (weeklyTrends.length >= 2) {
                const lastWeek = weeklyTrends[weeklyTrends.length - 1];
                const previousWeek = weeklyTrends[weeklyTrends.length - 2];
                const weeklyGrowth = lastWeek.active_users - previousWeek.active_users;
                const weeklyGrowthPercent =
                    previousWeek.active_users > 0
                        ? (weeklyGrowth / previousWeek.active_users) * 100
                        : 0;

                const growthEmoji = weeklyGrowth >= 0 ? "📈" : "📉";
                const growthSign = weeklyGrowth > 0 ? "+" : "";
                message += `${growthEmoji} WoW Growth: ${growthSign}${formatNumber(weeklyGrowth, 0)} users (${growthSign}${formatNumber(weeklyGrowthPercent, 1)}%)\n`;
            }
        } else {
            message += `• No weekly data available\n`;
        }

        message += `\n**📊 Monthly Activity Trends**\n`;
        if (monthlyTrends.length > 0) {
            const recentMonths = monthlyTrends.slice(-2); // Last 2 months
            recentMonths.forEach((month, index) => {
                const monthStart = new Date(month.month_start);
                const monthStr = monthStart.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                });
                const isCurrentMonth = index === recentMonths.length - 1;
                const prefix = isCurrentMonth ? "🔥" : "📊";
                message += `${prefix} ${monthStr}: ${formatNumber(month.active_users, 0)} users, ${formatNumber(month.total_transactions, 0)} txns\n`;
            });

            // Calculate monthly growth
            if (monthlyTrends.length >= 2) {
                const lastMonth = monthlyTrends[monthlyTrends.length - 1];
                const previousMonth = monthlyTrends[monthlyTrends.length - 2];
                const monthlyGrowth = lastMonth.active_users - previousMonth.active_users;
                const monthlyGrowthPercent =
                    previousMonth.active_users > 0
                        ? (monthlyGrowth / previousMonth.active_users) * 100
                        : 0;

                const growthEmoji = monthlyGrowth >= 0 ? "📈" : "📉";
                const growthSign = monthlyGrowth > 0 ? "+" : "";
                message += `${growthEmoji} MoM Growth: ${growthSign}${formatNumber(monthlyGrowth, 0)} users (${growthSign}${formatNumber(monthlyGrowthPercent, 1)}%)\n`;
            }
        } else {
            message += `• No monthly data available\n`;
        }

        // Engagement Insights
        message += `\n**💡 Engagement Insights**\n`;
        if (currentWeekActive > 0) {
            const avgTxsPerActiveUserThisWeek =
                weeklyTrends.length > 0
                    ? weeklyTrends[weeklyTrends.length - 1].total_transactions / currentWeekActive
                    : 0;
            message += `📊 Avg TXs per active user (this week): ${formatNumber(avgTxsPerActiveUserThisWeek, 1)}\n`;
        }

        if (currentMonthActive > 0) {
            const avgTxsPerActiveUserThisMonth =
                monthlyTrends.length > 0
                    ? monthlyTrends[monthlyTrends.length - 1].total_transactions /
                      currentMonthActive
                    : 0;
            message += `📊 Avg TXs per active user (this month): ${formatNumber(avgTxsPerActiveUserThisMonth, 1)}\n`;
        }

        // User retention insight
        const retentionRate =
            currentMonthActive > 0 && currentWeekActive > 0
                ? (currentWeekActive / currentMonthActive) * 100
                : 0;
        message += `🔄 Weekly retention rate: ${formatNumber(retentionRate, 1)}%\n`;

        // Add user segmentation if available
        if (engagementStats) {
            message += `\n**👥 User Segmentation**\n`;
            message += `📊 Active Users: ${formatNumber(engagementStats.activeUsers, 0)} (${formatNumber(engagementStats.activeUserRate, 1)}%)\n`;
            message += `💎 High Volume ($1K+): ${formatNumber(engagementStats.highVolumeUsers, 0)} (${formatNumber(engagementStats.highVolumeRate, 1)}%)\n`;
            message += `⭐ Super Active (10+ TXs): ${formatNumber(engagementStats.superActiveUsers, 0)}\n`;
            message += `🐋 Whales ($10K+): ${formatNumber(engagementStats.whaleUsers, 0)} (${formatNumber(engagementStats.whaleRate, 1)}%)\n`;
            message += `🆕 New Users (30d): ${formatNumber(engagementStats.recentUsers, 0)}\n`;
            message += `🔥 Very Recent (7d): ${formatNumber(engagementStats.veryRecentUsers, 0)}\n`;
        }

        // Add copy trading performance if available
        if (activitySummary) {
            message += `\n**🤖 Copy Trading Performance**\n`;
            message += `📈 Last 24h: ${formatNumber(activitySummary.last24Hours.totalTrades, 0)} trades (${formatNumber(activitySummary.last24Hours.successRate, 1)}% success)\n`;
            message += `📊 Last 7d: ${formatNumber(activitySummary.last7Days.totalTrades, 0)} trades (${formatNumber(activitySummary.last7Days.successRate, 1)}% success)\n`;

            if (activitySummary.last24Hours.totalTrades > 0) {
                message += `✅ 24h Success: ${formatNumber(activitySummary.last24Hours.successful, 0)} | ❌ Failed: ${formatNumber(activitySummary.last24Hours.failed, 0)}\n`;
            }
        }

        message += `\n💡 *Active users = users with ≥1 transaction in the period*`;

        await ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
        console.error("Error in bot statistics:", error);
        await ctx.reply("❌ Failed to fetch comprehensive statistics. Please try again later.");
    }
}

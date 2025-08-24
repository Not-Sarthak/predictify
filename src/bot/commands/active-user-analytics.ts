import { Context } from "telegraf";
import {
    getCurrentWeekActiveUsers,
    getCurrentMonthActiveUsers,
    getWeeklyActiveUserTrends,
    getMonthlyActiveUserTrends,
} from "../../utils/active-user-analytics";

/**
 * Handle active user analytics command - shows weekly and monthly active user statistics
 */
export async function handleActiveUserAnalytics(ctx: Context) {
    try {
        // Get current period statistics
        const [currentWeekActive, currentMonthActive] = await Promise.all([
            getCurrentWeekActiveUsers(),
            getCurrentMonthActiveUsers(),
        ]);

        // Get trends
        const [weeklyTrends, monthlyTrends] = await Promise.all([
            getWeeklyActiveUserTrends(4), // Last 4 weeks
            getMonthlyActiveUserTrends(3), // Last 3 months
        ]);

        let message = "📊 **Active User Analytics**\n\n";

        // Current period stats
        message += "**📅 Current Period**\n";
        message += `• This Week: **${currentWeekActive}** active users\n`;
        message += `• This Month: **${currentMonthActive}** active users\n\n`;

        // Weekly trends
        message += "**📈 Weekly Trends**\n";
        if (weeklyTrends.length > 0) {
            weeklyTrends.slice(-4).forEach((week, index) => {
                const weekStart = new Date(week.week_start);
                const weekStr = weekStart.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                });
                message += `• Week ${week.week_number} (${weekStr}): **${week.active_users}** users, ${week.total_transactions} txns\n`;
            });
        } else {
            message += "• No weekly data available\n";
        }

        message += "\n**📊 Monthly Trends**\n";
        if (monthlyTrends.length > 0) {
            monthlyTrends.slice(-3).forEach((month) => {
                const monthStart = new Date(month.month_start);
                const monthStr = monthStart.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                });
                message += `• ${monthStr}: **${month.active_users}** users, ${month.total_transactions} txns\n`;
            });
        } else {
            message += "• No monthly data available\n";
        }

        // Calculate growth if we have data
        if (weeklyTrends.length >= 2) {
            const lastWeek = weeklyTrends[weeklyTrends.length - 1];
            const previousWeek = weeklyTrends[weeklyTrends.length - 2];
            const weeklyGrowth = lastWeek.active_users - previousWeek.active_users;
            const weeklyGrowthPercent =
                previousWeek.active_users > 0
                    ? ((weeklyGrowth / previousWeek.active_users) * 100).toFixed(1)
                    : "N/A";

            message += `\n**📊 Growth**\n`;
            message += `• Weekly: ${weeklyGrowth >= 0 ? "📈" : "📉"} ${weeklyGrowth > 0 ? "+" : ""}${weeklyGrowth} users (${weeklyGrowthPercent}%)\n`;
        }

        if (monthlyTrends.length >= 2) {
            const lastMonth = monthlyTrends[monthlyTrends.length - 1];
            const previousMonth = monthlyTrends[monthlyTrends.length - 2];
            const monthlyGrowth = lastMonth.active_users - previousMonth.active_users;
            const monthlyGrowthPercent =
                previousMonth.active_users > 0
                    ? ((monthlyGrowth / previousMonth.active_users) * 100).toFixed(1)
                    : "N/A";

            message += `• Monthly: ${monthlyGrowth >= 0 ? "📈" : "📉"} ${monthlyGrowth > 0 ? "+" : ""}${monthlyGrowth} users (${monthlyGrowthPercent}%)\n`;
        }

        message +=
            "\n💡 *Active users are those who executed at least 1 transaction in the period*";

        await ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
        console.error("Error in active user analytics:", error);
        await ctx.reply("❌ Failed to fetch active user analytics. Please try again later.");
    }
}

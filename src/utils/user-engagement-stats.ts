import { db } from "../lib/supabase";

/**
 * Get additional user engagement statistics
 */
export async function getUserEngagementStats() {
    try {
        // Get users with different activity levels
        const { data: allUsers } = await db("Users").select(
            "id, total_volume, markets_traded, txns_executed, created_at"
        );

        if (!allUsers) return null;

        // Calculate user segments
        const activeUsers = allUsers.filter((u) => (u.txns_executed || 0) > 0);
        const highVolumeUsers = allUsers.filter((u) => (u.total_volume || 0) > 1000); // $1000+
        const superActiveUsers = allUsers.filter((u) => (u.txns_executed || 0) >= 10);
        const whaleUsers = allUsers.filter((u) => (u.total_volume || 0) > 10000); // $10000+

        // Calculate time-based metrics
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const recentUsers = allUsers.filter((u) => new Date(u.created_at) >= thirtyDaysAgo);
        const veryRecentUsers = allUsers.filter((u) => new Date(u.created_at) >= sevenDaysAgo);

        return {
            totalUsers: allUsers.length,
            activeUsers: activeUsers.length,
            highVolumeUsers: highVolumeUsers.length,
            superActiveUsers: superActiveUsers.length,
            whaleUsers: whaleUsers.length,
            recentUsers: recentUsers.length,
            veryRecentUsers: veryRecentUsers.length,

            // Percentages
            activeUserRate: allUsers.length > 0 ? (activeUsers.length / allUsers.length) * 100 : 0,
            highVolumeRate:
                allUsers.length > 0 ? (highVolumeUsers.length / allUsers.length) * 100 : 0,
            whaleRate: allUsers.length > 0 ? (whaleUsers.length / allUsers.length) * 100 : 0,

            // Volume stats
            totalVolume: allUsers.reduce((sum, u) => sum + (u.total_volume || 0), 0),
            avgVolumeActive:
                activeUsers.length > 0
                    ? activeUsers.reduce((sum, u) => sum + (u.total_volume || 0), 0) /
                      activeUsers.length
                    : 0,
            avgVolumeWhale:
                whaleUsers.length > 0
                    ? whaleUsers.reduce((sum, u) => sum + (u.total_volume || 0), 0) /
                      whaleUsers.length
                    : 0,
        };
    } catch (error) {
        console.error("Error fetching user engagement stats:", error);
        return null;
    }
}

/**
 * Get recent activity summary for dashboard
 */
export async function getRecentActivitySummary() {
    try {
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Get recent auto trades (copy trades)
        const { data: recentAutoTrades } = await db("Auto_Trade")
            .select("status, created_at")
            .gte("created_at", twentyFourHoursAgo.toISOString());

        const { data: weeklyAutoTrades } = await db("Auto_Trade")
            .select("status, created_at")
            .gte("created_at", sevenDaysAgo.toISOString());

        const successful24h = recentAutoTrades?.filter((t) => t.status === "executed").length || 0;
        const failed24h = recentAutoTrades?.filter((t) => t.status === "failed").length || 0;
        const total24h = recentAutoTrades?.length || 0;

        const successfulWeekly =
            weeklyAutoTrades?.filter((t) => t.status === "executed").length || 0;
        const failedWeekly = weeklyAutoTrades?.filter((t) => t.status === "failed").length || 0;
        const totalWeekly = weeklyAutoTrades?.length || 0;

        return {
            last24Hours: {
                totalTrades: total24h,
                successful: successful24h,
                failed: failed24h,
                successRate: total24h > 0 ? (successful24h / total24h) * 100 : 0,
            },
            last7Days: {
                totalTrades: totalWeekly,
                successful: successfulWeekly,
                failed: failedWeekly,
                successRate: totalWeekly > 0 ? (successfulWeekly / totalWeekly) * 100 : 0,
            },
        };
    } catch (error) {
        console.error("Error fetching recent activity summary:", error);
        return null;
    }
}

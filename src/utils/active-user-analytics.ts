import { db } from "../lib/supabase";

/**
 * Get current week's active users
 */
export async function getCurrentWeekActiveUsers(): Promise<number> {
    const now = new Date();
    const year = now.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);

    const { data, error } = await db("Weekly_Active_Users")
        .select("user_id")
        .eq("year", year)
        .eq("week_number", weekNumber);

    if (error) {
        console.error("Error fetching current week active users:", error);
        return 0;
    }

    return data?.length || 0;
}

/**
 * Get current month's active users
 */
export async function getCurrentMonthActiveUsers(): Promise<number> {
    const now = new Date();
    const year = now.getFullYear();
    const monthNumber = now.getMonth() + 1;

    const { data, error } = await db("Monthly_Active_Users")
        .select("user_id")
        .eq("year", year)
        .eq("month_number", monthNumber);

    if (error) {
        console.error("Error fetching current month active users:", error);
        return 0;
    }

    return data?.length || 0;
}

/**
 * Get weekly active users for a specific week
 */
export async function getWeeklyActiveUsers(
    year: number,
    weekNumber: number
): Promise<{
    count: number;
    users: Array<{ user_id: number; transaction_count: number; week_start: string }>;
}> {
    const { data, error } = await db("Weekly_Active_Users")
        .select("user_id, transaction_count, week_start")
        .eq("year", year)
        .eq("week_number", weekNumber);

    if (error) {
        console.error("Error fetching weekly active users:", error);
        return { count: 0, users: [] };
    }

    const users =
        data?.map((user) => ({
            user_id: user.user_id,
            transaction_count: user.transaction_count || 0,
            week_start: user.week_start,
        })) || [];

    return {
        count: users.length,
        users,
    };
}

/**
 * Get monthly active users for a specific month
 */
export async function getMonthlyActiveUsers(
    year: number,
    monthNumber: number
): Promise<{
    count: number;
    users: Array<{ user_id: number; transaction_count: number; month_start: string }>;
}> {
    const { data, error } = await db("Monthly_Active_Users")
        .select("user_id, transaction_count, month_start")
        .eq("year", year)
        .eq("month_number", monthNumber);

    if (error) {
        console.error("Error fetching monthly active users:", error);
        return { count: 0, users: [] };
    }

    const users =
        data?.map((user) => ({
            user_id: user.user_id,
            transaction_count: user.transaction_count || 0,
            month_start: user.month_start,
        })) || [];

    return {
        count: users.length,
        users,
    };
}

/**
 * Get weekly active user trends (last N weeks)
 */
export async function getWeeklyActiveUserTrends(weeksBack: number = 8): Promise<
    Array<{
        year: number;
        week_number: number;
        week_start: string;
        active_users: number;
        total_transactions: number;
    }>
> {
    // Calculate the date range
    const now = new Date();
    const weeksAgo = new Date(now.getTime() - weeksBack * 7 * 24 * 60 * 60 * 1000);

    const { data, error } = await db("Weekly_Active_Users")
        .select("year, week_number, week_start, user_id, transaction_count")
        .gte("week_start", weeksAgo.toISOString())
        .order("year", { ascending: true })
        .order("week_number", { ascending: true });

    if (error) {
        console.error("Error fetching weekly trends:", error);
        return [];
    }

    // Group by week and aggregate
    const weekMap = new Map<
        string,
        {
            year: number;
            week_number: number;
            week_start: string;
            users: Set<number>;
            total_transactions: number;
        }
    >();

    data?.forEach((record) => {
        const key = `${record.year}-${record.week_number}`;
        if (!weekMap.has(key)) {
            weekMap.set(key, {
                year: record.year,
                week_number: record.week_number,
                week_start: record.week_start,
                users: new Set(),
                total_transactions: 0,
            });
        }

        const week = weekMap.get(key)!;
        week.users.add(record.user_id);
        week.total_transactions += record.transaction_count || 0;
    });

    return Array.from(weekMap.values()).map((week) => ({
        year: week.year,
        week_number: week.week_number,
        week_start: week.week_start,
        active_users: week.users.size,
        total_transactions: week.total_transactions,
    }));
}

/**
 * Get monthly active user trends (last N months)
 */
export async function getMonthlyActiveUserTrends(monthsBack: number = 6): Promise<
    Array<{
        year: number;
        month_number: number;
        month_start: string;
        active_users: number;
        total_transactions: number;
    }>
> {
    // Calculate the date range
    const now = new Date();
    const monthsAgo = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);

    const { data, error } = await db("Monthly_Active_Users")
        .select("year, month_number, month_start, user_id, transaction_count")
        .gte("month_start", monthsAgo.toISOString())
        .order("year", { ascending: true })
        .order("month_number", { ascending: true });

    if (error) {
        console.error("Error fetching monthly trends:", error);
        return [];
    }

    // Group by month and aggregate
    const monthMap = new Map<
        string,
        {
            year: number;
            month_number: number;
            month_start: string;
            users: Set<number>;
            total_transactions: number;
        }
    >();

    data?.forEach((record) => {
        const key = `${record.year}-${record.month_number}`;
        if (!monthMap.has(key)) {
            monthMap.set(key, {
                year: record.year,
                month_number: record.month_number,
                month_start: record.month_start,
                users: new Set(),
                total_transactions: 0,
            });
        }

        const month = monthMap.get(key)!;
        month.users.add(record.user_id);
        month.total_transactions += record.transaction_count || 0;
    });

    return Array.from(monthMap.values()).map((month) => ({
        year: month.year,
        month_number: month.month_number,
        month_start: month.month_start,
        active_users: month.users.size,
        total_transactions: month.total_transactions,
    }));
}

/**
 * Check if a user is active in the current week
 */
export async function isUserActiveThisWeek(userId: number): Promise<boolean> {
    const now = new Date();
    const year = now.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);

    const { data, error } = await db("Weekly_Active_Users")
        .select("id")
        .eq("user_id", userId)
        .eq("year", year)
        .eq("week_number", weekNumber)
        .single();

    return !error && data !== null;
}

/**
 * Check if a user is active in the current month
 */
export async function isUserActiveThisMonth(userId: number): Promise<boolean> {
    const now = new Date();
    const year = now.getFullYear();
    const monthNumber = now.getMonth() + 1;

    const { data, error } = await db("Monthly_Active_Users")
        .select("id")
        .eq("user_id", userId)
        .eq("year", year)
        .eq("month_number", monthNumber)
        .single();

    return !error && data !== null;
}

/**
 * Get user activity summary
 */
export async function getUserActivitySummary(userId: number): Promise<{
    isActiveThisWeek: boolean;
    isActiveThisMonth: boolean;
    weeklyTransactionCount: number;
    monthlyTransactionCount: number;
}> {
    const now = new Date();
    const year = now.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
    const monthNumber = now.getMonth() + 1;

    const [weeklyData, monthlyData] = await Promise.all([
        db("Weekly_Active_Users")
            .select("transaction_count")
            .eq("user_id", userId)
            .eq("year", year)
            .eq("week_number", weekNumber)
            .single(),
        db("Monthly_Active_Users")
            .select("transaction_count")
            .eq("user_id", userId)
            .eq("year", year)
            .eq("month_number", monthNumber)
            .single(),
    ]);

    return {
        isActiveThisWeek: !weeklyData.error && weeklyData.data !== null,
        isActiveThisMonth: !monthlyData.error && monthlyData.data !== null,
        weeklyTransactionCount: weeklyData.data?.transaction_count || 0,
        monthlyTransactionCount: monthlyData.data?.transaction_count || 0,
    };
}

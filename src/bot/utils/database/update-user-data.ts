import { db } from "../../../lib/supabase";

export async function updateUserMarketsTraded(userId: number, prevMarketsTraded: number) {
    await db("Users")
        .update({
            markets_traded: prevMarketsTraded + 1,
        })
        .eq("id", userId);
}

export async function updateUserTransactionsExecuted(userId: number, prevExecutedTxns: number) {
    await db("Users")
        .update({
            txns_executed: prevExecutedTxns + 1,
        })
        .eq("id", userId);

    // Update active user tracking when a transaction is executed
    await updateActiveUserTracking(userId);
}

/**
 * Updates weekly and monthly active user tracking when a user executes a transaction
 */
export async function updateActiveUserTracking(userId: number) {
    const now = new Date();

    // Calculate week information (ISO week)
    const year = now.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);

    // Calculate week start (Monday)
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // Convert Sunday (0) to 7
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek + 1);
    monday.setHours(0, 0, 0, 0);

    // Calculate month information
    const monthStart = new Date(year, now.getMonth(), 1);
    const monthNumber = now.getMonth() + 1;

    try {
        // Update or insert weekly active user record
        const { data: existingWeeklyRecord } = await db("Weekly_Active_Users")
            .select("*")
            .eq("user_id", userId)
            .eq("year", year)
            .eq("week_number", weekNumber)
            .single();

        if (existingWeeklyRecord) {
            // Increment transaction count for existing week
            await db("Weekly_Active_Users")
                .update({
                    transaction_count: (existingWeeklyRecord.transaction_count || 0) + 1,
                })
                .eq("id", existingWeeklyRecord.id);
        } else {
            // Create new weekly record
            await db("Weekly_Active_Users").insert({
                user_id: userId,
                week_start: monday.toISOString(),
                year: year,
                week_number: weekNumber,
                transaction_count: 1,
            });
        }

        // Update or insert monthly active user record
        const { data: existingMonthlyRecord } = await db("Monthly_Active_Users")
            .select("*")
            .eq("user_id", userId)
            .eq("year", year)
            .eq("month_number", monthNumber)
            .single();

        if (existingMonthlyRecord) {
            // Increment transaction count for existing month
            await db("Monthly_Active_Users")
                .update({
                    transaction_count: (existingMonthlyRecord.transaction_count || 0) + 1,
                })
                .eq("id", existingMonthlyRecord.id);
        } else {
            // Create new monthly record
            await db("Monthly_Active_Users").insert({
                user_id: userId,
                month_start: monthStart.toISOString(),
                year: year,
                month_number: monthNumber,
                transaction_count: 1,
            });
        }
    } catch (error) {
        console.error("Error updating active user tracking:", error);
        // Don't throw error to avoid breaking transaction flow
    }
}

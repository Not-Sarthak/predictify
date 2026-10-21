import { supabase } from "../../../lib/supabase";
import { feeTransaction } from "../../../utils/fees/fee";

interface UserStatIncrements {
    amountDeposited?: number;
    feesTotal?: number;
    marketsTraded?: number;
    txnsExecuted?: number;
    totalVolume?: number;
    totalPnl?: number;
    numberOfReferrals?: number;
}

// The addition happens inside one UPDATE in postgres (see the increment_user_stats migration), so
// concurrent writers can't overwrite each other's increments the way read-add-write did
export async function incrementUserStats(userId: number, increments: UserStatIncrements) {
    // Returns the error so callers that retry can tell a failed increment apart
    const { error } = await supabase.rpc("increment_user_stats", {
        p_user_id: userId,
        p_amount_deposited: increments.amountDeposited,
        p_fees_total: increments.feesTotal,
        p_markets_traded: increments.marketsTraded,
        p_txns_executed: increments.txnsExecuted,
        p_total_volume: increments.totalVolume,
        p_total_pnl: increments.totalPnl,
        p_number_of_referrals: increments.numberOfReferrals,
    });

    if (error) {
        console.error(`Error incrementing stats for user ${userId}:`, error);
    }

    return error;
}

export async function updateUserMarketsTraded(userId: number) {
    await incrementUserStats(userId, { marketsTraded: 1 });
}

export async function updateUserTransactionsExecuted(userId: number) {
    await incrementUserStats(userId, { txnsExecuted: 1 });

    // Update active user tracking when a transaction is executed
    await updateActiveUserTracking(userId);
}

export async function updateUserDepositAndFees(userId: number, amount: number) {
    const { fee, finalAmount } = feeTransaction(amount);
    await incrementUserStats(userId, { amountDeposited: finalAmount, feesTotal: fee });
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
        const { error } = await supabase.rpc("record_user_activity", {
            p_user_id: userId,
            p_year: year,
            p_week_number: weekNumber,
            p_week_start: monday.toISOString(),
            p_month_number: monthNumber,
            p_month_start: monthStart.toISOString(),
        });

        if (error) throw error;
    } catch (error) {
        console.error("Error updating active user tracking:", error);
        // Don't throw error to avoid breaking transaction flow
    }
}

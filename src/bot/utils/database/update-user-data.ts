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
}

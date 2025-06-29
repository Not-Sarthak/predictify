import { supabase } from "../../../lib/supabase";

export async function getUserWatchedWalletsCount(userId: string) {
    try {
        const { data, error } = await supabase
            .from("Copy_Wallets")
            .select("wallet_address")
            .eq("user_id", Number(userId));

        if (error) {
            throw new Error(error.message, { cause: error.cause });
        }

        return data.length;
    } catch (error) {
        console.error("Error fetching user's watched wallets: ", error);
        return null;
    }
}

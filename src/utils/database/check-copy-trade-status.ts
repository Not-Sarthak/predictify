import { supabase } from "../../config/supabase";

export async function checkCopyTradeStatus(userId: string) {
    try {
        const { data, error } = await supabase
            .from("Copy_Wallets")
            .select("wallet_address, is_enabled")
            .eq("user_id", userId);

        if (error) {
            throw new Error(error.message, { cause: error.cause });
        }

        return data;
    } catch (error) {
        console.error("Error fetching user's copy trade status: ", error);
        return null;
    }
}

import { supabase } from "../../../lib/supabase";

export async function checkWalletCopyTradeStatus(userId: string) {
    try {
        const { data, error } = await supabase
            .from("Copy_Wallets")
            .select("wallet_address, is_enabled")
            .eq("user_id", Number(userId));

        if (error) {
            throw new Error(error.message, { cause: error.cause });
        }

        return data;
    } catch (error) {
        console.error("Error fetching user's copy trade status: ", error);
        return null;
    }
}

export async function checkCopyTradeUserStatus(userId: string): Promise<boolean | null> {
    try {
        const { data, error } = await supabase
            .from("Users")
            .select("is_copytrading_enabled")
            .eq("id", Number(userId))
            .single();

        if (error) {
            throw new Error(error.message, { cause: error.cause });
        }

        return data.is_copytrading_enabled;
    } catch (error) {
        console.error("Error fetching user's copy trade status: ", error);
        return null;
    }
}

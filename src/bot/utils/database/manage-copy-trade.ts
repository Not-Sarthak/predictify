import { supabase } from "../../../lib/supabase";

export async function enableUserCopyTrade(userId: string) {
    try {
        const { error } = await supabase
            .from("Copy_Wallets")
            .update({ is_enabled: true })
            .eq("userId", userId);

        if (error) {
            throw new Error(error.message, { cause: error.cause });
        }

        return true;
    } catch (error) {
        console.error("Error enabling user copy trade: ", error);
        return null;
    }
}

export async function disableUserCopyTrade(userId: string) {
    try {
        const { error } = await supabase
            .from("Copy_Wallets")
            .update({ is_enabled: false })
            .eq("userId", userId);

        if (error) {
            throw new Error(error.message, { cause: error.cause });
        }

        return true;
    } catch (error) {
        console.error("Error enabling user copy trade: ", error);
        return null;
    }
}

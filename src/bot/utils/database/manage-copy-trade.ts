import { db } from "../../../lib/supabase";

export async function manageUserCopyTrade(userId: string, enable: boolean) {
    try {
        const { error } = await db("Copy_Wallets")
            .update({ is_enabled: enable })
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

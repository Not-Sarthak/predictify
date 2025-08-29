import { db } from "../../../lib/supabase";

export async function getUserWalletAddresses(userId: number): Promise<{
    wallet_address: string;
    solana_address: string;
} | null> {
    try {
        const { data, error } = await db("Users")
            .select("wallet_address, solana_address")
            .filter("id", "eq", userId)
            .single();

        if (error) {
            throw new Error(error.message, { cause: error.cause });
        }

        if (!data) return null;

        return data;
    } catch (error) {
        console.error("Error fetching user wallet: ", error);
        return null;
    }
}

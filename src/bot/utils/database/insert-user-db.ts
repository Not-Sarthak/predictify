import { db } from "@/lib/supabase";
import type { PostgrestError } from "@supabase/supabase-js";

export async function insertUserInDb(
    userId: number,
    username: string,
    walletAddress: string,
    privateKey: string,
    api_credentials: string,
    solanaAddress: string,
    solanaPrivateKey: string
): Promise<{ success: true; error: null } | { success: false; error: PostgrestError }> {
    const { error } = await db("Users").insert([
        {
            id: userId,
            telegram_username: username,
            wallet_address: walletAddress,
            private_key: privateKey,
            api_credentials,
            solana_address: solanaAddress,
            solana_private_key: solanaPrivateKey,
        },
    ]);

    if (error) return { success: false, error };

    return { success: true, error: null };
}

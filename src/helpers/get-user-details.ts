import { supabase } from "../lib/supabase";

export async function getUserDetails(userId: number) {
    try {
        const { data, error } = await supabase
            .from("Users")
            .select("*")
            .filter("id", "eq", userId)
            .single();

        if (error) {
            throw new Error(error.message, { cause: error.cause });
        }

        return data;
    } catch (error) {
        console.error("Error fetching user wallet: ", error);
        return null;
    }
}

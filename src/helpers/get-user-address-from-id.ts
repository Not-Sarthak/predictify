import { supabase } from "../config/supabase";

export async function getUserAddressFromId(
  userId: number
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("Users")
      .select("wallet_address")
      .filter("id", "eq", userId)
      .single();

    if (error) {
      throw new Error(error.message, { cause: error.cause });
    }

    return data.wallet_address;
  } catch (error) {
    console.error("Error fetching user wallet: ", error);
    return null;
  }
}

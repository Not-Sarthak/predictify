import { db } from "../../../lib/supabase";

export async function saveCopyTradeConfig(userId: string, configType: string, configValue: string) {
    const { error } = await db("Users")
        .update({
            config_type: configType,
            config_value: configValue,
        })
        .eq("id", Number(userId));

    if (error) return false;
    return true;
}

export async function getUserCopyTradeConfig(userId: string) {
    const { data, error } = await db("Users")
        .select("config_type, config_value")
        .eq("id", Number(userId))
        .single();

    if (error) {
        return { error: error.message, data: null };
    }

    return { data, error: null };
}

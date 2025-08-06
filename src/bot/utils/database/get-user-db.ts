import { db } from "../../../lib/supabase";
import type { DBError } from "../../../shared/errors";
import type { TableRow } from "../../../types/supabase/tables";

export async function getUserByIdFromDb(
    userId: number
): Promise<{ data: TableRow<"Users"> | null; error: null } | { data: null; error: DBError }> {
    const { data, error } = await db("Users").select("*").eq("id", userId).single();

    if (error && error.code !== "PGRST116") {
        return {
            data: null,
            error: {
                ...error,
                context: "getUserByIdFromDb",
            },
        };
    }

    return {
        data,
        error: null,
    };
}

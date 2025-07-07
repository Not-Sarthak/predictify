import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env";
import type { Database } from "@/types/supabase/db";

// TODO:FIX - REMOVE THIS AND REPLACE EVERYTHING WITH `db`
export const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

export const db = <const T extends keyof Database["public"]["Tables"]>(table: T) =>
    supabase.from(table);

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./env";
import type { Database } from "../shared/types/supabase";

// TODO:FIX - REMOVE THIS AND REPLACE EVERYTHING WITH `db`
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export const db = (table: keyof Database["public"]["Tables"]) => supabase.from(table);

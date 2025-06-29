import type { PostgrestError } from "@supabase/supabase-js";

export type DBError = PostgrestError & { context?: string };

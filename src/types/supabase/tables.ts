import type { Database } from "@/types/supabase/db";

type DBTables = keyof Database["public"]["Tables"];

export type TableRow<T extends DBTables> = Database["public"]["Tables"][T]["Row"];

export type TableInsert<T extends DBTables> = Database["public"]["Tables"][T]["Insert"];

export type TableUpdate<T extends DBTables> = Database["public"]["Tables"][T]["Update"];

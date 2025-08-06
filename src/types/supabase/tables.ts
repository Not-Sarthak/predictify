import type { Database } from "./db";

type DBTables = keyof Database["public"]["Tables"];

export type TableRow<T extends DBTables> = Database["public"]["Tables"][T]["Row"];

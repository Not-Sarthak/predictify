import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env";
import type { Database } from "../types/supabase/db";

// Configure Supabase client with extended timeout and retry settings for better connectivity
// Especially important for users in regions with restricted internet access (e.g., China)
const supabaseOptions = {
    db: {
        schema: "public" as const,
    },
    realtime: {
        params: {
            eventsPerSecond: 10,
        },
        heartbeatIntervalMs: 30000, // 30 seconds heartbeat
        reconnectAfterMs: (tries: number) => Math.min(tries * 1000, 10000), // Exponential backoff up to 10s
    },
    global: {
        headers: {
            "X-Client-Info": "supabase-js-node",
        },
    },
    // Extended timeout for slow connections - configurable via environment
    fetch: (url: string, options: any = {}) => {
        return fetch(url, {
            ...options,
            // Use configurable timeout from environment
            signal: AbortSignal.timeout(env.DB_TIMEOUT_MS),
        });
    },
};

// TODO:FIX - REMOVE THIS AND REPLACE EVERYTHING WITH `db`
export const supabase = createClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseOptions
);

export const db = <const T extends keyof Database["public"]["Tables"]>(table: T) =>
    supabase.from(table);

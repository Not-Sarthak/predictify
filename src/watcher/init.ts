import { resumeAllMonitoring } from "./copy-trade";
import { connectToSupabaseRealtime } from "./index";

/**
 * Initialize the copy trading watcher system
 * This combines both the new monitoring system and the existing Supabase realtime
 */
export async function initializeCopyTrading() {
    try {
        await resumeAllMonitoring();
        await connectToSupabaseRealtime();

        console.log("Copy Trading System Initialized Successfully");
    } catch (error) {
        console.error("Failed to initialize copy trading system:", error);
        throw error;
    }
}

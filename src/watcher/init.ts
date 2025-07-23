import { resumeAllMonitoring } from "./copy-trade";
import { connectToSupabaseRealtime } from "./index";

/**
 * Initialize the copy trading watcher system
 * This combines both the new monitoring system and the existing Supabase realtime
 */
export async function initializeCopyTrading() {
    try {
        console.log("Initializing copy trading system...");

        // Resume monitoring for all existing watched wallets
        await resumeAllMonitoring();

        // Connect to Supabase realtime for new wallet additions/removals
        // This is currently commented out in the old system but we'll keep the structure
        // await connectToSupabaseRealtime();

        console.log("Copy trading system initialized successfully");
    } catch (error) {
        console.error("Failed to initialize copy trading system:", error);
        throw error;
    }
}

import { db } from "../lib/supabase";
import { env } from "../config/env";

/**
 * Test database connectivity with retry logic
 * Useful for debugging connectivity issues in different regions
 */
export async function testDatabaseConnectivity(): Promise<{
    success: boolean;
    latency?: number;
    error?: string;
    retries?: number;
}> {
    const startTime = Date.now();
    let retries = 0;

    for (let attempt = 1; attempt <= env.DB_RETRY_COUNT; attempt++) {
        try {
            retries = attempt - 1;

            // Simple query to test connectivity
            const { data, error } = await db("Users").select("id").limit(1).single();

            if (error && error.code !== "PGRST116") {
                // PGRST116 is "not found" which is ok for connectivity test
                throw new Error(error.message);
            }

            const latency = Date.now() - startTime;

            return {
                success: true,
                latency,
                retries,
            };
        } catch (error) {
            console.warn(`Database connectivity test attempt ${attempt} failed:`, error);

            if (attempt === env.DB_RETRY_COUNT) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    retries,
                };
            }

            // Wait before retrying
            const delay = 1000 * Math.pow(2, attempt - 1);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    return {
        success: false,
        error: "Max retries exceeded",
        retries,
    };
}

/**
 * Log detailed connectivity information for debugging
 */
export async function logConnectivityInfo(): Promise<void> {
    console.log("=== Database Connectivity Test ===");
    console.log(`Region-specific settings:`);
    console.log(`- Retry count: ${env.DB_RETRY_COUNT}`);
    console.log(`- Timeout: ${env.DB_TIMEOUT_MS}ms`);
    console.log(`- Supabase URL: ${env.SUPABASE_URL}`);

    const result = await testDatabaseConnectivity();

    if (result.success) {
        console.log(`✅ Database connectivity: SUCCESS`);
        console.log(`- Latency: ${result.latency}ms`);
        console.log(`- Retries needed: ${result.retries}`);
    } else {
        console.log(`❌ Database connectivity: FAILED`);
        console.log(`- Error: ${result.error}`);
        console.log(`- Retries attempted: ${result.retries}`);
    }

    console.log("=================================");
}

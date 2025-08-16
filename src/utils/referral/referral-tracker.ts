import { db } from "../../lib/supabase";
import { env } from "../../config/env";

export interface ReferralStats {
    totalReferred: number;
    totalEarnings: number;
    referralLink: string;
    referredUsers: {
        username: string;
        joinDate: string;
        totalVolume: number;
    }[];
}

// Retry helper function for database operations, especially useful for users in regions with connectivity issues
async function retryDatabaseOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = env.DB_RETRY_COUNT,
    delayMs: number = 1000
): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error as Error;
            console.warn(`Database operation attempt ${attempt}/${maxRetries} failed:`, {
                error: error instanceof Error ? error.message : error,
                attempt,
                maxRetries,
            });

            // If it's the last attempt, throw the error
            if (attempt === maxRetries) {
                throw lastError;
            }

            // Wait before retrying, with exponential backoff
            const delay = delayMs * Math.pow(2, attempt - 1);
            console.log(`Retrying in ${delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    throw lastError!;
}

export async function trackReferralRelationship(
    newUserId: number,
    referrerUsername: string
): Promise<{ success: boolean; referrer?: any; error?: string }> {
    try {
        const referrer = await retryDatabaseOperation(async () => {
            const { data, error } = await db("Users")
                .select("*")
                .eq("telegram_username", referrerUsername)
                .single();

            if (error || !data) {
                throw new Error("Referrer not found");
            }
            return data;
        });

        await retryDatabaseOperation(async () => {
            const { error } = await db("Users")
                .update({ referred_code: referrerUsername })
                .eq("id", newUserId);

            if (error) {
                throw new Error("Failed to update referral relationship");
            }
        });

        // Update referrer's count
        await retryDatabaseOperation(async () => {
            const { error } = await db("Users")
                .update({
                    number_of_referrals: (referrer.number_of_referrals || 0) + 1,
                })
                .eq("id", referrer.id);

            if (error) {
                throw new Error("Failed to update referrer count");
            }
        });

        return { success: true, referrer };
    } catch (error) {
        console.error("Error tracking referral relationship:", error);
        return { success: false, error: error instanceof Error ? error.message : "Internal error" };
    }
}

export async function calculateReferralEarnings(
    userId: number,
    tradeVolume: number,
    treasuryFee: number
): Promise<void> {
    try {
        const user = await retryDatabaseOperation(async () => {
            const { data, error } = await db("Users")
                .select("referred_code")
                .eq("id", userId)
                .single();

            if (error || !data || !data.referred_code || data.referred_code === "OPEN") {
                return null;
            }
            return data;
        });

        if (!user || !user.referred_code) {
            return;
        }

        const referrer = await retryDatabaseOperation(async () => {
            const { data, error } = await db("Users")
                .select("id, fees_total")
                .eq("telegram_username", user.referred_code!)
                .single();

            if (error || !data) {
                return null;
            }
            return data;
        });

        if (!referrer) {
            return;
        }

        const referralFee = treasuryFee * 0.25;

        await retryDatabaseOperation(async () => {
            const { error } = await db("Users")
                .update({
                    fees_total: (referrer.fees_total || 0) + referralFee,
                })
                .eq("id", referrer.id);

            if (error) {
                throw new Error("Failed to update referral earnings");
            }
        });

        console.log(
            `✅ Added referral earning: $${referralFee.toFixed(4)} to referrer ${referrer.id} from user ${userId}`
        );
    } catch (error) {
        console.error("Error calculating referral earnings:", error);
    }
}

export async function getReferralStats(
    userId: number,
    botUsername?: string
): Promise<ReferralStats> {
    try {
        // Fetch user data with retry logic
        const user = await retryDatabaseOperation(async () => {
            const { data, error } = await db("Users")
                .select("telegram_username, number_of_referrals, fees_total")
                .eq("id", userId)
                .single();

            if (error || !data) {
                throw new Error(`User not found: ${error?.message || "Unknown error"}`);
            }
            return data;
        });

        // Fetch referred users with retry logic
        const referredUsers = await retryDatabaseOperation(async () => {
            const { data, error } = await db("Users")
                .select("telegram_username, created_at, total_volume")
                .eq("referred_code", user.telegram_username);

            if (error) {
                console.error("Error fetching referred users:", error);
                // Return empty array instead of throwing for referred users failure
                return [];
            }
            return data || [];
        });

        const referredUsersList = referredUsers.map((referredUser) => ({
            username: referredUser.telegram_username || "Anonymous",
            joinDate: new Date(referredUser.created_at).toLocaleDateString(),
            totalVolume: referredUser.total_volume || 0,
        }));

        const referralLink = botUsername
            ? `https://t.me/${botUsername}?start=${user.telegram_username}`
            : `t.me/${user.telegram_username}`;

        // Log successful referral stats fetch for monitoring
        console.log(
            `✅ Referral stats fetched successfully for user ${userId} (@${user.telegram_username})`
        );

        return {
            totalReferred: user.number_of_referrals || 0,
            totalEarnings: user.fees_total || 0,
            referralLink,
            referredUsers: referredUsersList,
        };
    } catch (error) {
        console.error("Error getting referral stats:", error);

        // Enhanced error logging with user context for monitoring regional issues
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("🚨 REFERRAL_STATS_ERROR", {
            userId,
            error: errorMessage,
            timestamp: new Date().toISOString(),
            retryCount: env.DB_RETRY_COUNT,
            timeoutMs: env.DB_TIMEOUT_MS,
            // This helps identify patterns in regional connectivity issues
            errorType:
                error instanceof Error && error.message.includes("timeout")
                    ? "TIMEOUT"
                    : error instanceof Error && error.message.includes("network")
                      ? "NETWORK"
                      : "OTHER",
        });

        // Return fallback data instead of throwing
        return {
            totalReferred: 0,
            totalEarnings: 0,
            referralLink: "N/A",
            referredUsers: [],
        };
    }
}

export async function getReferrerFromUsername(
    username: string
): Promise<{ id: number; username: string } | null> {
    try {
        const referrer = await retryDatabaseOperation(async () => {
            const { data, error } = await db("Users")
                .select("id, telegram_username")
                .eq("telegram_username", username)
                .single();

            if (error || !data) {
                return null;
            }
            return data;
        });

        if (!referrer) {
            return null;
        }

        return {
            id: referrer.id,
            username: referrer.telegram_username,
        };
    } catch (error) {
        console.error("Error getting referrer from username:", error);
        return null;
    }
}

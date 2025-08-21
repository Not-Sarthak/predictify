import { redisClient } from "../lib/redis";
import type { SupportedLanguage } from "../i18n";

/**
 * Get user's language preference from Redis
 * TODO: Move to database once language_preference field is added to Users table
 */
export async function getUserLanguage(userId: number): Promise<SupportedLanguage> {
    try {
        const language = await redisClient.get(`user:language:${userId}`);

        if (!language) {
            return "en"; // Default to English
        }

        // Validate that the stored language is supported
        if (language === "en" || language === "zh") {
            return language;
        }

        return "en"; // Fallback to English for invalid values
    } catch (error) {
        console.error("Error fetching user language:", error);
        return "en"; // Default to English on error
    }
}

/**
 * Update user's language preference in Redis
 * TODO: Move to database once language_preference field is added to Users table
 */
export async function updateUserLanguage(
    userId: number,
    language: SupportedLanguage
): Promise<{ success: boolean; error?: string }> {
    try {
        await redisClient.set(`user:language:${userId}`, language);
        return { success: true };
    } catch (error) {
        console.error("Error updating user language:", error);
        return { success: false, error: "Internal server error" };
    }
}

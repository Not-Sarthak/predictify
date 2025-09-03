import { redisClient } from "../lib/redis";
import type { SupportedLanguage } from "../i18n";

type CacheEntry<T> = { value: T; expires: number };

const TWELVE_HOURS = 12 * 60 * 60 * 1000; // 12 hours in ms
const userLanguageCache = new Map<number, CacheEntry<SupportedLanguage>>();

// Background cleanup every 12 hours
setInterval(() => {
    const now = Date.now();
    for (const [userId, entry] of userLanguageCache.entries()) {
        if (entry.expires < now) {
            userLanguageCache.delete(userId);
        }
    }
}, TWELVE_HOURS).unref(); // unref so it won't block shutdown

/**
 * Get user's language preference from Redis
 * TODO: Move to database once language_preference field is added to Users table
 */
export async function getUserLanguage(userId: number): Promise<SupportedLanguage> {
    const cached = userLanguageCache.get(userId);

    // Lazy eviction
    if (cached && cached.expires > Date.now()) {
        return cached.value;
    } else if (cached) {
        userLanguageCache.delete(userId);
    }

    try {
        const language = await redisClient.get(`user:language:${userId}`);

        const validLang: SupportedLanguage =
            language === "en" || language === "zh" ? language : "en";

        // Store in memory cache
        userLanguageCache.set(userId, {
            value: validLang,
            expires: Date.now() + TWELVE_HOURS,
        });

        return validLang;
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

        // Clear the in-memory cache so next call to getUserLanguage fetches fresh data
        userLanguageCache.delete(userId);

        return { success: true };
    } catch (error) {
        console.error("Error updating user language:", error);
        return { success: false, error: "Internal server error" };
    }
}

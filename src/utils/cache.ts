import { redisClient } from "../lib/redis";

export async function getOrSetCache<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = 60
): Promise<T> {
    const cached = await redisClient.get(key);
    if (cached) {
        return JSON.parse(cached) as T;
    }

    const fresh = await fetchFn();

    if (fresh !== null && fresh !== undefined) {
        await redisClient.setEx(key, ttlSeconds, JSON.stringify(fresh));
    }

    return fresh;
}

export async function clearCache(key: string): Promise<boolean> {
    try {
        const result = await redisClient.del(key);
        return result > 0; // true if a key was deleted
    } catch (err) {
        console.error(`[Redis] Failed to clear cache for key ${key}:`, err);
        return false;
    }
}

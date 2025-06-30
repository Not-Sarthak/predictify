// TODO:FIX - Apply Caching methods where needed

import { redisClient } from "@/lib/redis";

type CacheType = "str" | "json";

class Cache {
    // Default TTL in Seconds
    private defaultTTL: number = 3600;

    constructor() {}

    async has(key: string) {
        return (await redisClient.exists(key)) === 1;
    }

    async get<T = any>(key: string, type: CacheType = "str"): Promise<T | string | null> {
        const value = await redisClient.get(key);
        if (value === null) return null;

        if (type === "json") {
            try {
                return JSON.parse(value);
            } catch {
                return null;
            }
        }

        return value;
    }

    async put(key: string, value: any, type: CacheType = "str", ttl?: number): Promise<void> {
        const stringifiedValue = type === "json" ? JSON.stringify(value) : String(value);
        const expiry = ttl ?? this.defaultTTL;

        await redisClient.set(key, stringifiedValue, {
            expiration: {
                type: "EX",
                value: expiry,
            },
        });
    }
}

const cache = new Cache();

export { cache };

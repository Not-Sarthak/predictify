import { createClient } from "redis";
import { REDIS_URL } from "./env.ts";

const redisClient = createClient({
    url: REDIS_URL,
});

await redisClient.connect();

export { redisClient };

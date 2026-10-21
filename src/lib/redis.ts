import { createClient } from "redis";
import { env } from "../config/env";

const redisClient = createClient({
    url: env.REDIS_URL,
});

// Without an error listener a dropped connection is an unhandled error event and kills the
// process; with one the client logs it and reconnects on its own
redisClient.on("error", (error) => {
    console.error("[Redis] Client Error:", error);
});

await redisClient.connect();

export { redisClient };

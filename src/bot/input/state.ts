import { redisClient } from "../../lib/redis";

const key = (userId: string) => `user:input_state:${userId}`;

export async function setUserInputState(userId: string, flow: string) {
    await redisClient.set(key(userId), flow);
}

export async function getUserInputState(userId: string): Promise<string | null> {
    return await redisClient.get(key(userId));
}

export async function clearUserInputState(userId: string) {
    await redisClient.del(key(userId));
}

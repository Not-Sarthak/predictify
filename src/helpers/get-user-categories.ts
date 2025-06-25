import { redisClient } from "../config/redis";
import { CATEGORY_LIST } from "../constants/polymarket";

export async function getUsersSubscribedCategories(userId: string) {
    const subscribedCategories: string[] = [];

    for (const category of CATEGORY_LIST) {
        const isMember = await redisClient.sIsMember(`subscriptions:${category}`, userId);
        if (isMember) {
            subscribedCategories.push(category);
        }
    }

    return subscribedCategories;
}

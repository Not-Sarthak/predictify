import { redisClient } from "../lib/redis";
import { CATEGORY_LIST } from "../shared/constants";

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

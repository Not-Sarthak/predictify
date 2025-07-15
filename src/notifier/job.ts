import { sendNotificationToUser } from "@/bot/utils/notify-user";
import { redisClient } from "@/lib/redis";
import { CATEGORY_LIST, HALF_DAY_IN_MS } from "@/shared/constants";

type Category = (typeof CATEGORY_LIST)[number];

const CATEGORY_MAP = new Map<Category, string>(
    CATEGORY_LIST.map((category) => [
        category,
        `https://gamma-api.polymarket.com/events?active=true&archived=false&tag_slug=${encodeURIComponent(
            category.toLowerCase()
        )}&closed=false&order=creationDate&ascending=false&offset=0&limit=1`,
    ])
);

export const notifyUsersAboutNewMarkets = async () => {
    const jobs: Promise<void>[] = [];

    CATEGORY_MAP.forEach((url, category) => {
        const job = (async () => {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    const error = await response.text();
                    throw new Error(
                        `Request failed for [${category}]: ${response.status} ${error}`
                    );
                }

                const data = await response.json();
                const latestEvent = data[0];
                if (!latestEvent) return;

                const creationTime = new Date(latestEvent.creationDate).getTime();
                const now = Date.now();

                const isNew = now - creationTime <= HALF_DAY_IN_MS;
                if (!isNew) return;

                const subscribers = await redisClient.sMembers(`subscriptions:${category}`);

                for (const userId of subscribers) {
                    await sendNotificationToUser(userId, latestEvent, category);
                }
            } catch (err) {
                const error = err instanceof Error ? err : new Error(JSON.stringify(err));
                console.error(
                    `❌ [${new Date().toISOString()}] Error in category [${category}]: ${error.message}\n${error.stack}\n`
                );
            }
        })();

        jobs.push(job);
    });

    await Promise.all(jobs);
};

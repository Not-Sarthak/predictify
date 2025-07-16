import type { EventData } from "@/types/polymarket";

import { redisClient } from "@/lib/redis";
import { HALF_DAY_IN_MS } from "@/shared/constants";
import { bot } from "@/bot";
import { Markup } from "telegraf";
import { layoutButtons } from "@/bot/utils";
import { normalizeTitle } from "@/notifier/utils";

export const notifyUsersAboutNewMarkets = async () => {
    const now = Date.now();
    const categoryToMarketMap = new Map<string, EventData[]>();

    const categories = await redisClient.hKeys(`categories`);

    // TODO:FIX - Fetch more than 1 events (could be more than 1 event created in 12 hour timeframe) (add filter for start_date_min)
    await Promise.all(
        categories.map(async (category) => {
            try {
                const url = new URL("https://gamma-api.polymarket.com/events");

                url.searchParams.set("active", "true");
                url.searchParams.set("archived", "false");
                url.searchParams.set("tag_slug", category.toLowerCase());
                url.searchParams.set("closed", "false");
                url.searchParams.set("order", "createdAt");
                url.searchParams.set("ascending", "false");
                url.searchParams.set("offset", "0");
                url.searchParams.set("limit", "100");

                const res = await fetch(url);
                if (!res.ok) return;

                const data: EventData[] = await res.json();
                if (!data || data.length === 0) return;

                for (const event of data) {
                    const creationTime = new Date(event.createdAt).getTime();
                    const isNew = now - creationTime <= HALF_DAY_IN_MS;
                    if (!isNew) continue;

                    if (!categoryToMarketMap.has(category)) {
                        categoryToMarketMap.set(category, []);
                    }

                    categoryToMarketMap.get(category)!.push(event);
                }
            } catch (err) {
                console.error(`❌ Failed to fetch category ${category}`, err);
            }
        })
    );

    const userKeys = await redisClient.keys("user:subs:*");
    const userIds = userKeys.map((key) => key.split(":")[2]);

    await Promise.all(
        userIds.map(async (userId) => {
            const userCategories = await redisClient.sMembers(`user:subs:${userId}`);
            const newEvents: EventData[] = [];

            for (const category of userCategories) {
                const events = categoryToMarketMap.get(category);
                if (events && events.length > 0) {
                    newEvents.push(...events);
                }
            }

            if (newEvents.length === 0) return;

            const latestEventsByTitle = new Map<string, EventData>();

            for (const event of newEvents) {
                const key = normalizeTitle(event.title);
                const existing = latestEventsByTitle.get(key);

                if (
                    !existing ||
                    new Date(event.createdAt).getTime() > new Date(existing.createdAt).getTime()
                ) {
                    latestEventsByTitle.set(key, event);
                }
            }

            const finalEvents = Array.from(latestEventsByTitle.values());

            const messageLines = finalEvents.map((event, idx) => `${idx + 1}. ${event.title}`);
            const message = `🆕 *New Markets in Your Subscribed Categories*\n\n${messageLines.join("\n")}`;
            const buttons = finalEvents.map((event, idx) => ({
                text: `#${idx + 1}`,
                callback_data: `view_markets:${event.id}`,
            }));
            const buttonLayout = layoutButtons(buttons);

            try {
                await bot.telegram.sendMessage(userId, message, {
                    reply_markup: Markup.inlineKeyboard(buttonLayout).reply_markup,
                });
            } catch (err) {
                console.error(`❌ Failed to notify user ${userId}`, err);
            }
        })
    );
};

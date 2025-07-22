import type { EventData } from "@/types/polymarket";

import { redisClient } from "@/lib/redis";
import { HALF_DAY_IN_MS } from "@/shared/constants";
import { bot } from "@/bot";
import { Markup } from "telegraf";
import { layoutButtons } from "@/bot/utils";
import { normalizeTitle } from "@/notifier/utils";
import { capitalize } from "@/utils";

export const notifyUsersAboutNewMarkets = async () => {
    const now = Date.now();
    const categoryToMarketMap = new Map<string, EventData[]>();
    const categories = await redisClient.hKeys(`categories`);

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
            const categorizedEvents = new Map<string, EventData[]>();

            for (const category of userCategories) {
                const events = categoryToMarketMap.get(category);
                if (events && events.length > 0) {
                    // Deduplicate by normalized title
                    const map = new Map<string, EventData>();
                    for (const e of events) {
                        const key = normalizeTitle(e.title);
                        if (
                            !map.has(key) ||
                            new Date(e.createdAt).getTime() >
                                new Date(map.get(key)!.createdAt).getTime()
                        ) {
                            map.set(key, e);
                        }
                    }
                    categorizedEvents.set(category, Array.from(map.values()));
                }
            }

            if (categorizedEvents.size === 0) return;

            let idx = 1;
            const buttons: { text: string; callback_data: string }[] = [];
            const messageParts: string[] = ["🔔 *NEW MARKETS*"];

            for (const [category, events] of categorizedEvents.entries()) {
                messageParts.push(`\n*${capitalize(category)}* (${events.length} markets)`);
                for (const event of events) {
                    const price = `$${(event.volume || 0 / 100).toFixed(0)}`;
                    const eventDate = new Date(event.endDate);
                    const date = isNaN(eventDate.getTime())
                        ? "N/A"
                        : eventDate.toLocaleDateString("en-US", {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                          });

                    messageParts.push(`${idx}. ${event.title}`);
                    messageParts.push(`💧 ${price} • 📅 ${date}\n`);

                    buttons.push({
                        text: `#${idx}`,
                        callback_data: `view_markets:${event.id}`,
                    });

                    idx++;
                }
            }

            messageParts.push("\n📈 Use /subscriptions to manage subscriptions");

            const message = messageParts.join("\n");
            const buttonLayout = layoutButtons(buttons);

            try {
                await bot.telegram.sendMessage(userId, message, {
                    parse_mode: "Markdown",
                    reply_markup: Markup.inlineKeyboard(buttonLayout).reply_markup,
                });
            } catch (err) {
                console.error(`❌ Failed to notify user ${userId}`, err);
            }
        })
    );
};

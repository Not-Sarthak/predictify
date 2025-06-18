import { redisClient } from "../config/redis";
import { CATEGORY_LIST } from "../constants/polymarket";
import { sendNotification } from "./notify-users";

const seenMarketIdsMap: Record<string, Set<string>> = {};

CATEGORY_LIST.forEach((category) => {
  seenMarketIdsMap[category] = new Set<string>();
});

export async function pollNewMarkets() {
  console.log("POLLING...");

  await Promise.all(
    CATEGORY_LIST.map(async (category) => {
      const seenSet = seenMarketIdsMap[category];

      const url = `https://gamma-api.polymarket.com/events?active=true&archived=false&tag_slug=${encodeURIComponent(
        category.toLowerCase()
      )}&closed=false&order=volume24hr&ascending=false&offset=0`;

      const subscribers = await redisClient.sMembers(
        `subscriptions:${category}`
      );

      try {
        const res = await fetch(url);
        const events = await res.json();

        if (!events.length) return;

        for (const event of events) {
          if (!event.markets) continue;

          for (const market of event.markets) {
            if (!seenSet.has(market.id)) {
              seenSet.add(market.id);

              for (const userId of subscribers) {
                await sendNotification(userId, market, category);
              }
            }
          }
        }
      } catch (err) {
        console.error(`❌ Error fetching ${category}:`, err);
      }
    })
  );
}

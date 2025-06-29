import { awaitingMarketTermInputSet } from "@/bot";
import { Markup, type Context } from "telegraf";

export async function handleMarketTermTextMessage(
    ctx: Context,
    textMessage: string,
    userId: string
) {
    const queryText = textMessage.split(/\s+/)[0];

    const response = await fetch(
        `https://gamma-api.polymarket.com/events?tag_slug=${queryText}&limit=5&offset=0&closed=false`
    );

    const marketData = await response.json();

    const marketTitleButtons = [];
    for (const market of marketData) {
        marketTitleButtons.push([
            Markup.button.callback(
                market.markets[0].question,
                `selected_market:${market.markets[0].id}`
            ),
        ]);
    }
    marketTitleButtons.push([
        Markup.button.callback("Next Markets ⏭️", `fetch_markets:${queryText}:next:5`),
    ]);

    awaitingMarketTermInputSet.delete(userId);

    return ctx.reply("Markets: ", {
        reply_markup: Markup.inlineKeyboard(marketTitleButtons).reply_markup,
    });
}

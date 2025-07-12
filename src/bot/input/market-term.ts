import { awaitingMarketTermInputSet } from "@/bot";
import { padButtonText } from "@/bot/utils";
import { Markup, type Context } from "telegraf";

export async function handleMarketTermTextMessage(
    ctx: Context,
    textMessage: string,
    userId: string
) {
    const queryText = textMessage.split(/\s+/)[0].toLowerCase();

    const response = await fetch(
        `https://gamma-api.polymarket.com/events?tag_slug=${queryText}&limit=5&offset=0&closed=false`
    );

    const marketData = await response.json();

    if (marketData.length === 0) {
        return ctx.reply("❌ There are no markets available for this term.");
    }

    const marketTitleButtons = [];
    for (const market of marketData) {
        marketTitleButtons.push([
            Markup.button.callback(
                padButtonText(market.markets[0].question),
                `selected_market:${market.markets[0].id}`
            ),
        ]);
    }

    if (marketData.length > 5) {
        marketTitleButtons.push([
            Markup.button.callback("Next Markets ⏭️", `fetch_markets:${queryText}:next:5`),
        ]);
    }

    awaitingMarketTermInputSet.delete(userId);

    return ctx.reply("Markets: ", {
        reply_markup: Markup.inlineKeyboard(marketTitleButtons).reply_markup,
    });
}

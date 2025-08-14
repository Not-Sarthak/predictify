import { CLOSE_BUTTON } from "../ui/buttons";
import { padButtonText } from "../utils";
import { Markup, type Context } from "telegraf";
import { encodeMarketConditionId } from "../../utils/encoding";

export async function handleMarketTermTextMessage(ctx: Context, textMessage: string) {
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
                `selected_market:${encodeMarketConditionId(market.markets[0].id)}`
            ),
        ]);
    }

    if (marketData.length === 5) {
        marketTitleButtons.push([
            Markup.button.callback("Next Markets ⏭️", `fetch_markets:${queryText}:next:5`),
        ]);
    }

    return ctx.reply("Markets: ", {
        reply_markup: Markup.inlineKeyboard([...marketTitleButtons, [CLOSE_BUTTON]]).reply_markup,
    });
}

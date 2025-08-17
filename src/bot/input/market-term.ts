import type { Context } from "telegraf";

import { handleViewTopMarketsByCategory } from "../callbacks/trade";

export async function handleMarketTermTextMessage(ctx: Context, textMessage: string) {
    const queryText = textMessage.split(/\s+/)[0].toLowerCase();
    return handleViewTopMarketsByCategory(ctx, queryText);
}

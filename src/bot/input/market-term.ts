import type { Context } from "telegraf";

import { handleViewTopMarketsByCategory } from "../callbacks/trade";
import { getUserLanguage } from "../../helpers/user-language";

export async function handleMarketTermTextMessage(
    ctx: Context,
    textMessage: string,
    userId: number
) {
    const queryText = textMessage.split(/\s+/)[0].toLowerCase();

    const language = await getUserLanguage(userId);
    return handleViewTopMarketsByCategory(ctx, queryText, undefined, undefined, language);
}

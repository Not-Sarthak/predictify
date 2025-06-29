import type { Context } from "telegraf";

import { handleAutoTradeMenu } from "@/bot/callbacks/autotrade";
import { handleSettingsMenu } from "@/bot/callbacks/settings";
import { handleSubscriptionsMenu } from "@/bot/callbacks/subscriptions";
import { handleTradeMenu } from "@/bot/callbacks/trade";

export async function handleStartMenuCallbacks(ctx: Context, target: string) {
    switch (target) {
        case "subscriptions":
            return handleSubscriptionsMenu(ctx);
        case "trade":
            return handleTradeMenu(ctx);
        case "autotrade":
            return handleAutoTradeMenu(ctx);
        case "settings":
            return handleSettingsMenu(ctx);
        default:
            return ctx.answerCbQuery();
    }
}

import { Markup, type Context } from "telegraf";
import { TRADE_STRATEGIES_MENU_BUTTONS } from "../ui/buttons/menu";
import { handleHighProbabilityCommand } from "../commands/high-probability";

export async function handleStrategiesMenu(ctx: Context) {
    const message = `
🎯 **Trade Strategies**

Choose from our advanced trading strategies to maximize your profits on prediction markets.

**Available Strategies:**
• **High-Probability Markets** - Target markets with two modes, Conservative for 60-90% probability and Aggressive for 80-95% probability.
• **More strategies coming soon...**

Select a strategy to get started:
    `;

    return ctx.editMessageText(message, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard(TRADE_STRATEGIES_MENU_BUTTONS).reply_markup,
    });
}

export async function handleStrategiesCallbacks(ctx: Context, action: string) {
    switch (action) {
        case "highprob":
            return handleHighProbabilityCommand(ctx);
        case "coming_soon":
            return ctx.answerCbQuery("🚧 More strategies coming soon! Stay tuned.", {
                show_alert: true,
            });
        default:
            return ctx.answerCbQuery();
    }
}

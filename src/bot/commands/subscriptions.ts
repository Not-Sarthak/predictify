import { SUBSCRIPTIONS_MENU_BUTTONS } from "../ui/buttons";
import { Markup, type Context } from "telegraf";

export async function handleSubscriptionsCommand(ctx: Context) {
    const keyboard = Markup.inlineKeyboard(SUBSCRIPTIONS_MENU_BUTTONS);

    return ctx.reply("📋 Choose a subscription option:", keyboard);
}

import { Markup, type Context } from "telegraf";
import { TRADE_MENU_BUTTONS } from "../ui/buttons";

export async function handleTradeCommand(ctx: Context) {
    const keyboard = Markup.inlineKeyboard(TRADE_MENU_BUTTONS);

    return ctx.reply("📋 Choose a trading option:", keyboard);
}

import { TRADE_MENU_BUTTONS } from "@/bot/ui/buttons";
import { Markup, type Context } from "telegraf";

export async function handleTradeMenu(ctx: Context) {
    return ctx.editMessageReplyMarkup(Markup.inlineKeyboard(TRADE_MENU_BUTTONS).reply_markup);
}

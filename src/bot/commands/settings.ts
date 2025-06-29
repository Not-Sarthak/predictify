import { SETTINGS_MENU_BUTTONS } from "@/bot/ui/buttons";
import { Markup, type Context } from "telegraf";

export async function handleSettingsCommand(ctx: Context) {
    const keyboard = Markup.inlineKeyboard(SETTINGS_MENU_BUTTONS);

    return ctx.reply("📋 Wallet Settings:", keyboard);
}

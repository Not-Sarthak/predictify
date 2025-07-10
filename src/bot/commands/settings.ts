import { WALLET_SETTINGS_MENU } from "@/bot/ui/buttons";
import { Markup, type Context } from "telegraf";

export async function handleSettingsCommand(ctx: Context) {
    const keyboard = Markup.inlineKeyboard(WALLET_SETTINGS_MENU);

    return ctx.reply("📋 Wallet/Funds:", keyboard);
}

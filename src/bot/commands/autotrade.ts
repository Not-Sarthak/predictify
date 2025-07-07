import { generateAutoTradeMenu } from "@/bot/ui/messages";
import { type Context } from "telegraf";

export async function handleAutoTradeCommand(ctx: Context) {
    const menuResult = await generateAutoTradeMenu(ctx);
    if (!menuResult) return;

    const { message, replyMarkup } = menuResult;

    await ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: replyMarkup,
    });
}

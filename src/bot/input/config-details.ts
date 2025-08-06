import { saveCopyTradeConfig } from "../utils/database/trading-config";
import type { Context } from "telegraf";

export async function handleConfigTextMessage(
    ctx: Context,
    textMessage: string,
    userId: number,
    configType: string
) {
    const isSuccess = await saveCopyTradeConfig(userId.toString(), configType, textMessage);

    if (!isSuccess) {
        return ctx.reply("⚠️ Error saving config. Please try again");
    }

    return ctx.reply(
        `✅ *Configuration Updated*\n\n` +
            `**${configType}:** ${textMessage}\n\n` +
            `Your copy trading settings have been updated.`,
        { parse_mode: "Markdown" }
    );
}

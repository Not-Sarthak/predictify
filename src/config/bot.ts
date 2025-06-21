import { Telegraf } from "telegraf";
import { TG_BOT_TOKEN } from "./env";
import { botCommands } from "../constants/telegram";
import { handleCallbackQuery, handleStartCommand } from "./bot-commands";

const bot = new Telegraf(TG_BOT_TOKEN);

bot.telegram.setMyCommands(botCommands);

bot.command("start", handleStartCommand);
bot.on("callback_query", handleCallbackQuery);

export { bot };

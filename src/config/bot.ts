import { Telegraf } from "telegraf";
import { TG_BOT_TOKEN } from "./env";
import { botCommands } from "../constants/telegram";
import {
  handleCallbackQuery,
  handleStartCommand,
  handleUserTextMessage,
} from "./bot-commands";
import { message } from "telegraf/filters";

const bot = new Telegraf(TG_BOT_TOKEN);

const awaitingWalletDetailsInputSet = new Set<string>();
const awaitingMarketTermInputSet = new Set<string>();
const awaitingOrderDetailsInputSet = new Set<string>();

bot.telegram.setMyCommands(botCommands);

bot.command("start", handleStartCommand);
bot.on(message("text"), handleUserTextMessage);
bot.on("callback_query", handleCallbackQuery);

export {
  bot,
  awaitingWalletDetailsInputSet,
  awaitingMarketTermInputSet,
  awaitingOrderDetailsInputSet,
};

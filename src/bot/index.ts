import { Telegraf } from "telegraf";
import { env } from "../config/env";
import { botCommands } from "./commands";
import { message } from "telegraf/filters";
import { rejectBotSenders, requireId } from "./middlewares";
import {
    handleSettingsCommand,
    handleStartCommand,
    handleSubscriptionsCommand,
    handleTradeCommand,
} from "./commands";
import { handleUserTextMessage } from "./input";
import { handleCallbackQuery } from "@/bot/callbacks";
import { handleUserTradeHistoryCommand } from "@/bot/commands/history";
import { handleViewTradePositions } from "@/bot/callbacks/trade";
import { handleCancelOpenOrdersCommand } from "@/bot/commands/manage-limit-orders";
import { handleAutoTradeMenu } from "@/bot/ui/messages";

const bot = new Telegraf(env.TG_BOT_TOKEN);

bot.telegram.setMyCommands(botCommands);

// Register Middlewares
bot.use(requireId);
bot.use(rejectBotSenders);

// Command Handlers
bot.command("start", handleStartCommand);
bot.command("subscriptions", handleSubscriptionsCommand);
bot.command("trade", handleTradeCommand);
bot.command("autotrade", handleAutoTradeMenu);
bot.command("fund", handleSettingsCommand);
bot.command("history", handleUserTradeHistoryCommand);
bot.command("portfolio", handleViewTradePositions);
bot.command("manage", handleCancelOpenOrdersCommand);

// Text Input Handler
bot.on(message("text"), handleUserTextMessage);

// Button Callback Handler
bot.on("callback_query", handleCallbackQuery);

// Error Handling
bot.catch((err, _ctx) => {
    try {
        if (err) {
            console.error(err);
        }
    } catch (replyError) {
        console.error("Failed To Send Error Message To User:", replyError);
    }
});

export { bot };

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
    handleWatchlistCommand,
    handleHighProbabilityCommand,
    handleRefCommand,
    handleActiveUserAnalytics,
    handleDetailedAnalytics,
} from "./commands";
import { handleUserTextMessage } from "./input";
import { handleCallbackQuery } from "./callbacks";
import { handleUserTradeHistoryCommand } from "./commands/history";
import { handleViewTradePositions } from "./callbacks/trade";
import { handleShowManageOrdersMainMenu } from "./commands/manage-limit-orders";
import { handleAutoTradeMenu } from "./ui/messages";
import { handleViewProfileCallback } from "./callbacks/start";
import { handleMonitoringStats } from "./callbacks/autotrade";
import { handleBotStatistics } from "./commands/bot-statistics";

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
bot.command("manage", handleShowManageOrdersMainMenu);
bot.command("stats", handleViewProfileCallback);
bot.command("watchlist", (ctx) => handleWatchlistCommand(ctx));
bot.command("highprob", handleHighProbabilityCommand);
bot.command("ref", handleRefCommand);
bot.command("monitoring", handleMonitoringStats);
bot.command("statistics", handleBotStatistics);
bot.command("analytics", handleActiveUserAnalytics);
bot.command("detailed", handleDetailedAnalytics);

// Text Input Handler
bot.on(message("text"), handleUserTextMessage);

// Button Callback Handler
bot.on("callback_query", handleCallbackQuery);

// Error Handling
bot.catch((err, ctx) => {
    try {
        console.error("[BOT] Error occurred:", err);
        console.error("[BOT] Context:", {
            updateType: ctx.updateType,
            chatId: ctx.chat?.id,
            userId: ctx.from?.id,
            username: ctx.from?.username,
        });
        if (err) {
            console.error(err);
        }
    } catch (replyError) {
        console.error("Failed To Send Error Message To User:", replyError);
    }
});

export { bot };

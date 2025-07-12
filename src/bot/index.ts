// TODO:FIX - REFACTOR SETS TO REDIS
import { Telegraf } from "telegraf";
import { env } from "../config/env";
import { botCommands } from "./commands";
import { message } from "telegraf/filters";
import { rejectBotSenders, requireId } from "./middlewares";
import {
    handleAutoTradeCommand,
    handleSettingsCommand,
    handleStartCommand,
    handleSubscriptionsCommand,
    handleTradeCommand,
} from "./commands";
import { handleUserTextMessage } from "./input";
import { handleCallbackQuery } from "@/bot/callbacks";
import { handleUserTradeHistoryCommand } from "@/bot/commands/history";
import { handleViewTradePositions } from "@/bot/callbacks/trade";

const bot = new Telegraf(env.TG_BOT_TOKEN);

const awaitingWalletDetailsInputSet = new Set<string>();
const awaitingMarketTermInputSet = new Set<string>();
const awaitingOrderDetailsInputSet = new Set<string>();
const awaitingWalletMonitorInputSet = new Set<string>();
const awaitingConfigInputSet = new Map<string, string>();
const awaitingReferralCodeInputSet = new Set<string>();
const awaitingWithdrawalInputSet = new Set<string>();

bot.telegram.setMyCommands(botCommands);

// Register Middlewares
bot.use(requireId);
bot.use(rejectBotSenders);

// Command Handlers
bot.command("start", handleStartCommand);
bot.command("subscriptions", handleSubscriptionsCommand);
bot.command("trade", handleTradeCommand);
bot.command("autotrade", handleAutoTradeCommand);
bot.command("fund", handleSettingsCommand);
bot.command("history", handleUserTradeHistoryCommand);
bot.command("portfolio", handleViewTradePositions);

// Text Input Handlers
bot.on(message("text"), handleUserTextMessage);

// Button Callback Handlers
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

export {
    bot,
    awaitingWalletDetailsInputSet,
    awaitingMarketTermInputSet,
    awaitingOrderDetailsInputSet,
    awaitingWalletMonitorInputSet,
    awaitingConfigInputSet,
    awaitingReferralCodeInputSet,
    awaitingWithdrawalInputSet,
};

// TODO:FIX - REFACTOR SETS TO REDIS
import { Telegraf } from "telegraf";
import { env } from "../config/env";
import { botCommands } from "./constants";
import { message } from "telegraf/filters";
import { rejectBotSenders } from "./middlewares";
import {
    handleAutoTradeCommand,
    handleSettingsCommand,
    handleStartCommand,
    handleSubscriptionsCommand,
    handleTradeCommand,
} from "./commands";
import { handleUserTextMessage } from "./input";
import { handleCallbackQuery } from "@/bot/callbacks";
const bot = new Telegraf(env.TG_BOT_TOKEN);

const awaitingWalletDetailsInputSet = new Set<string>();
const awaitingMarketTermInputSet = new Set<string>();
const awaitingOrderDetailsInputSet = new Set<string>();
const awaitingWalletMonitorInputSet = new Set<string>();
const awaitingConfigInputSet = new Map<string, string>();
const awaitingBridgeAmountInputSet = new Set<string>();

if (env.NODE_ENV === "production") {
    const isWebhookSet = await bot.telegram.setWebhook(`${env.WEBHOOK_DOMAIN}/telegram/webhook`, {
        secret_token: env.SECRET_TOKEN,
    });

    if (!isWebhookSet) {
        console.error("Failed to set Webhook URL");
        process.exit(1);
    }
}

bot.telegram.setMyCommands(botCommands);

// Register Middlewares
bot.use(rejectBotSenders);

// Command Handlers
bot.command("start", handleStartCommand);
bot.command("subscriptions", handleSubscriptionsCommand);
bot.command("trade", handleTradeCommand);
bot.command("autotrade", handleAutoTradeCommand);
bot.command("settings", handleSettingsCommand);

// Text Input Handlers
bot.on(message("text"), handleUserTextMessage);

// Button Callback Handlers
bot.on("callback_query", handleCallbackQuery);

// Error Handling
bot.catch((err, ctx) => {
    try {
        if (ctx.reply) {
            console.error(err);
            ctx.reply("❌ An Error Occurred. Please Try Again Later.");
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
    awaitingBridgeAmountInputSet,
};

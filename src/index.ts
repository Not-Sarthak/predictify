import { Telegraf } from "telegraf";
import { TG_BOT_TOKEN, SECRET_TOKEN, WEBHOOK_DOMAIN } from "./config/env";
import { PORT } from "./constants/server";
import { botCommands } from "./constants/telegram";
import {
  handleCallbackQuery,
  handleMySubscriptionsCommand,
  handleSubscribeCommand,
  handleUnsubscribeCommand,
} from "./config/bot-commands";
import { pollNewMarkets } from "./utils/poll-new-markets";

export const bot = new Telegraf(TG_BOT_TOKEN);

bot.telegram.setMyCommands(botCommands);

bot.command("subscribe", handleSubscribeCommand);
bot.command("unsubscribe", handleUnsubscribeCommand);
bot.command("mysubscriptions", handleMySubscriptionsCommand);
bot.on("callback_query", handleCallbackQuery);

// Interval to Fetch new Markets
setInterval(() => {
  pollNewMarkets().catch(console.error);
}, 5_000);

// Initialize Telegram Bot Webhook
bot.launch(
  {
    webhook: {
      domain: WEBHOOK_DOMAIN,
      port: Number(PORT),
      path: "/telegram/webhook",
      secretToken: SECRET_TOKEN,
    },
  },
  () => {
    console.log("Bot is Running");
  }
);

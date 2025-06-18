import { Telegraf } from "telegraf";
import { TG_BOT_TOKEN, SECRET_TOKEN, WEBHOOK_DOMAIN } from "./src/config/env";
import { PORT } from "./src/constants/server";
import { botCommands } from "./src/constants/telegram";
import { 
  handleMySubscriptionsCommand, 
  handleSubscribeCommand, 
  handleUnsubscribeCommand 
} from "./src/config/bot-commands";

const bot = new Telegraf(TG_BOT_TOKEN);

bot.telegram.setMyCommands(botCommands);

bot.command("subscribe", handleSubscribeCommand);
bot.command("unsubscribe", handleUnsubscribeCommand);
bot.command("mysubscriptions", handleMySubscriptionsCommand);

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
    console.log("Bot is running");
  }
);
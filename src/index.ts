import { env } from "./config/env";
import { PORT } from "./shared/constants";
import { bot } from "./bot";
import { initializeCopyTrading } from "@/watcher/init";
import { notifier } from "@/notifier";
import { restoreTpSlWatchersFromRedis, restoreWatchersFromRedis } from "@/notifier/ws";

async function main() {
    // CRON JOB: Fetch New Markets every 12 Hours
    console.log(`[${new Date().toISOString()}] ✅ Started Cron Job...`);
    notifier.start();

    // Restores Watchers
    await restoreWatchersFromRedis();
    console.log(`[${new Date().toISOString()}] ✅ Restored Price Alert Watchers...`);

    await restoreTpSlWatchersFromRedis();
    console.log(`[${new Date().toISOString()}] ✅ Restored TP/SL Watchers...`);

    /**
     * COPY TRADING SYSTEM
     * Initialize the wallet monitoring and copy trading functionality
     */
    await initializeCopyTrading();

    // Initialize Telegram Bot w/ Webhook
    bot.launch(
        {
            webhook: {
                domain: env.WEBHOOK_DOMAIN,
                host: "0.0.0.0",
                port: Number(PORT),
                path: "/telegram/webhook",
                secretToken: env.SECRET_TOKEN,
            },
        },
        () => {
            console.log("Bot Server Listening...");
        }
    );
}

main();

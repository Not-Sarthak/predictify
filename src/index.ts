import { env } from "./config/env";
import { PORT } from "./shared/constants";
import { bot } from "./bot";
import { initializeCopyTrading } from "./watcher/init";
import { notifier } from "./notifier";
import { restoreUserTradeWatchers } from "./notifier/ws/limit-order-watcher";
import {
    restoreTpSlWatchersFromRedis,
    restorePriceWatchersFromRedis,
} from "./notifier/ws/price-watcher";
import { startHighProbAlerts } from "./notifier/high-prob-alerts";

async function main() {
    // CRON JOB: Fetch New Markets every 12 Hours
    notifier.start();
    console.log(`[${new Date().toISOString()}] ✅ Started Cron Job...`);

    // Restores Watchers
    await restorePriceWatchersFromRedis();
    console.log(`[${new Date().toISOString()}] ✅ Restored Price Alert Watchers...`);

    await restoreTpSlWatchersFromRedis();
    console.log(`[${new Date().toISOString()}] ✅ Restored TP/SL Watchers...`);

    await restoreUserTradeWatchers();
    console.log(`[${new Date().toISOString()}] ✅ Restored Limit Order Watchers...`);

    // Start High-Probability Market Alerts
    startHighProbAlerts();
    console.log(`[${new Date().toISOString()}] ✅ Started High-Probability Market Alerts...`);

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
            console.log(`[${new Date().toISOString()}] ✅ Bot Server Listening...`);
        }
    );
}

main();

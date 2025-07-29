import { env } from "./config/env";
import { API_SERVER_PORT, PORT } from "./shared/constants";
import { apiServer } from "@/api";
import { bot } from "./bot";
// import { connectToSupabaseRealtime } from "@/watcher";
import { tryCatch } from "./utils";
import { notifier } from "@/notifier";

async function main() {
    // Starts the API Server
    const { error } = await tryCatch(apiServer.listen({ port: API_SERVER_PORT, host: "0.0.0.0" }));
    if (error) {
        apiServer.log.error(error, "Failed to Start API Server");
        process.exit(1);
    }

    // CRON JOB: Fetch New Markets every 12 Hours
    console.log(`[${new Date().toISOString()}] ✅ Started Cron Job...`);
    notifier.start();

    /**
     * DISABLED AUTOTRADING TEMPORARILY
     */
    // Listens to copy wallets db updates
    // await connectToSupabaseRealtime();

    // Initialize Telegram Bot Webhook
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

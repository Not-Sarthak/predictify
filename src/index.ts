import { env } from "./config/env";
import { API_SERVER_PORT, PORT } from "./shared/constants";
import { apiServer } from "@/api";
import { bot } from "./bot";
import { channel } from "@/watcher";
import { tryCatch } from "./shared/utils";
import { resumeAllWalletMonitors } from "@/watcher/monitor-handlers";
// import { pollNewMarkets } from "./utils/polymarket/poll-new-markets";

export async function main() {
    // Starts the API Server
    const { error } = await tryCatch(apiServer.listen({ port: API_SERVER_PORT, host: "0.0.0.0" }));

    if (error) {
        apiServer.log.error(error, "Failed to Start API Server");
        process.exit(1);
    }

    apiServer.log.info(`API Server Started on PORT ${API_SERVER_PORT}`);

    // Interval to Fetch new Markets
    // setInterval(() => {
    //     pollNewMarkets().catch(console.error);
    // }, 5_000);

    // Resumes Intervals and listens to copy wallets db updates
    await resumeAllWalletMonitors();
    channel.subscribe((status) => {
        console.log("[SUBSCRIPTION STATUS]:", status);
    });

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
            console.log("Bot is Running");
        }
    );
}

main();

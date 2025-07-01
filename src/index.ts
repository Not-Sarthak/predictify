import { env } from "./config/env";
import { API_SERVER_PORT, PORT } from "./shared/constants";
import { pollNewMarkets } from "./utils/polymarket/poll-new-markets";
import { apiServer } from "@/api";
import { bot } from "./bot";
import { walletSocketServer } from "./utils/polymarket-socket/socket";
import { tryCatch } from "./shared/utils";

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

    // Initialize Telegram Bot Webhook
    bot.launch(
        {
            webhook: {
                domain: env.WEBHOOK_DOMAIN,
                port: Number(PORT),
                path: "/telegram/webhook",
                secretToken: env.SECRET_TOKEN,
            },
        },
        () => {
            console.log("Bot is Running");
        }
    );

    walletSocketServer.start();
}

main();

import { SECRET_TOKEN, WEBHOOK_DOMAIN } from "./config/env";
import { API_SERVER_PORT, PORT } from "./constants/server";
import { pollNewMarkets } from "./utils/polymarket/poll-new-markets";
import { apiServer } from "./api";
import { bot } from "./config/bot";
import { walletSocketServer } from "./utils/polymarket-socket/socket";
import { tryCatch } from "./shared/utils";

export async function main() {
    // Starts the API Server
    const { error } = await tryCatch(apiServer.listen({ port: API_SERVER_PORT, host: "0.0.0.0" }));

    if (error) {
        apiServer.log.error(error, "Failed to start API server");
        process.exit(1);
    }

    apiServer.log.info(`API Server listening on PORT ${PORT}`);

    // Interval to Fetch new Markets
    // setInterval(() => {
    //   pollNewMarkets().catch(console.error);
    // }, 5_000);

    // Initialize Telegram Bot Webhook
    // bot.launch(
    //     {
    //         webhook: {
    //             domain: WEBHOOK_DOMAIN,
    //             port: Number(PORT),
    //             path: "/telegram/webhook",
    //             secretToken: SECRET_TOKEN,
    //         },
    //     },
    //     () => {
    //         console.log("Bot is Running");
    //     }
    // );

    // console.log(
    //     `Socket Server Initialized on port ${walletSocketServer.getActiveConnections() >= 0 ? "ready" : "error"}`
    // );
}

main();

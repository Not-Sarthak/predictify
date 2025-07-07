import { env } from "./config/env";
import { API_SERVER_PORT, PORT } from "./shared/constants";
import { apiServer } from "@/api";
import { bot } from "./bot";
import { connectToSupabaseRealtime } from "@/watcher";
import { tryCatch } from "./shared/utils";
// import { pollNewMarkets } from "./utils/polymarket/poll-new-markets";

export async function main() {
    // Starts the API Server
    const { error } = await tryCatch(apiServer.listen({ port: API_SERVER_PORT, host: "0.0.0.0" }));
    if (error) {
        apiServer.log.error(error, "Failed to Start API Server");
        process.exit(1);
    }

    // Interval to Fetch new Markets
    // setInterval(() => {
    //     pollNewMarkets().catch(console.error);
    // }, 5_000);

    // Listens to copy wallets db updates
    await connectToSupabaseRealtime();

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
            console.log("Bot Server listening...");
        }
    );
}

main();

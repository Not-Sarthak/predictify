import { SECRET_TOKEN, WEBHOOK_DOMAIN } from "./config/env";
import { API_SERVER_PORT, PORT } from "./constants/server";
import { pollNewMarkets } from "./utils/polymarket/poll-new-markets";
import { server } from "./api";
import { bot } from "./config/bot";
import { walletSocketServer } from "./utils/polymarket-socket/socket";

// Interval to Fetch new Markets
// setInterval(() => {
//   pollNewMarkets().catch(console.error);
// }, 5_000);

// Starts the API Server
server.listen({ port: API_SERVER_PORT }, () => {
    console.log("API Server Started");
});

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

console.log(
    `Socket Server Initialized on port ${walletSocketServer.getActiveConnections() >= 0 ? "ready" : "error"}`
);

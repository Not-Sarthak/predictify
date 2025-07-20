import { POLYMARKET_WS_USER_URL } from "@/shared/constants";
import { generateOrderFilledMessage, getMarketQuestion } from "@/notifier/utils";
import { bot } from "@/bot";

type Auth = {
    apiKey: string;
    secret: string;
    passphrase: string;
};

export class PolymarketUserTradeWatcher {
    private socket: WebSocket;
    private userId: string;
    private marketId: string;
    private auth: Auth;

    constructor(userId: string, auth: Auth, marketId: string) {
        this.userId = userId;
        this.marketId = marketId;
        this.auth = auth;

        this.socket = new WebSocket(POLYMARKET_WS_USER_URL + "/user", ["stream-v1"]);
        this.registerHandlers();
    }

    private registerHandlers() {
        this.socket.onopen = () => this.onOpen();
        this.socket.onmessage = (event) => this.onMessage(event);
        this.socket.onerror = (event) => this.onError(event);
        this.socket.onclose = (event) => this.onClose(event);
    }

    private onOpen() {
        const msg = {
            type: "user",
            markets: [this.marketId],
            auth: this.auth,
        };

        this.socket.send(JSON.stringify(msg));
        console.log(`[WS] Subscribed for user ${this.userId} on market ${this.marketId}`);
    }

    private async onMessage(event: MessageEvent) {
        try {
            const data = JSON.parse(event.data.toString());
            const message = data[0];

            if (
                message.status === "CONFIRMED" &&
                message.event_type === "trade" &&
                message.market === this.marketId
            ) {
                const question = await getMarketQuestion(this.marketId);
                const txtMessage = generateOrderFilledMessage(message, question!);

                await bot.telegram.sendMessage(this.userId, txtMessage, {
                    parse_mode: "Markdown",
                });

                this.socket.close();
            }

            console.log("[WS] Message received:", data);
        } catch (err) {
            console.error("[WS] Failed to parse or handle message:", err);
        }
    }

    private onError(event: Event) {
        console.error("[WS] WebSocket error:", event);
    }

    private onClose(event: CloseEvent) {
        console.warn(`[WS] WebSocket closed: ${event.code} ${event.reason}`);
    }

    public close() {
        this.socket.close();
    }
}

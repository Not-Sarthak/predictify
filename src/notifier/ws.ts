import { POLYMARKET_WS_MARKET_URL, POLYMARKET_WS_USER_URL } from "@/shared/constants";
import {
    generateOrderFilledMessage,
    generatePriceAlertMessage,
    getMarketQuestion,
} from "@/notifier/utils";
import { bot } from "@/bot";
import { db } from "@/lib/supabase";
import { getUserDetails } from "@/helpers/get-user-details";

type Auth = {
    apiKey: string;
    secret: string;
    passphrase: string;
};

type PriceWatchConfig =
    | { type: "take_profit"; price: number; outcome: string }
    | { type: "stop_loss"; price: number; outcome: string }
    | { type: "alert_above"; price: number; outcome: string }
    | { type: "alert_below"; price: number; outcome: string };

export class PolymarketUserTradeWatcher {
    private socket: WebSocket;
    private userId: string;
    private marketId: string;
    private auth: Auth;

    constructor(userId: string, auth: Auth, marketId: string) {
        this.userId = userId;
        this.marketId = marketId;
        this.auth = auth;

        this.socket = new WebSocket(POLYMARKET_WS_USER_URL);
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
                const userDetails = await getUserDetails(Number(this.userId));
                const question = await getMarketQuestion(this.marketId);

                const amount = Number(message.price) * Number(message.size);
                const txtMessage = generateOrderFilledMessage(message, question!);

                await bot.telegram.sendMessage(this.userId, txtMessage, {
                    parse_mode: "Markdown",
                });

                await db("Users").update({
                    locked_balance: userDetails?.locked_balance || 0 - amount,
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

export class PolymarketMarketTradeWatcher {
    private socket: WebSocket;
    private userId: string;
    private assetId: string;
    private marketId: string;
    private config: PriceWatchConfig;
    private hasTriggered: boolean;
    private lastBestAsk: number = Infinity;

    constructor(userId: string, assetId: string, marketId: string, config: PriceWatchConfig) {
        this.userId = userId;
        this.assetId = assetId;
        this.marketId = marketId;
        this.config = config;
        this.hasTriggered = false;

        this.socket = new WebSocket(POLYMARKET_WS_MARKET_URL);
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
            type: "market",
            assets_ids: [this.assetId],
        };
        this.socket.send(JSON.stringify(msg));
        console.log("[START] New Connection: ", msg);
    }

    private async onMessage(event: MessageEvent) {
        if (this.hasTriggered) return;

        try {
            const eventData = JSON.parse(event.data.toString());
            const data = eventData[0];

            if (data.event_type !== "book") return;

            const asks = data.asks.map((a: any) => parseFloat(a.price)).filter(isFinite);
            const currentAsk = Math.min(...asks);

            if (!isFinite(currentAsk)) return;

            const { type, price, outcome } = this.config;

            let shouldTrigger = false;

            switch (type) {
                case "take_profit":
                    shouldTrigger = this.lastBestAsk < price && currentAsk > price;
                    break;
                case "stop_loss":
                    shouldTrigger = this.lastBestAsk > price && currentAsk < price;
                    break;
                case "alert_above":
                    shouldTrigger = this.lastBestAsk < price && currentAsk > price;
                    break;
                case "alert_below":
                    shouldTrigger = this.lastBestAsk > price && currentAsk < price;
                    break;
            }

            this.lastBestAsk = currentAsk;

            if (!shouldTrigger) return;

            this.hasTriggered = true;

            const question = await getMarketQuestion(this.marketId);
            const basePayload = {
                question: question || "Unknown Market",
                thresholdPrice: price,
                currentPrice: currentAsk,
                outcomeSide: outcome,
            };

            await bot.telegram.sendMessage(
                this.userId,
                generatePriceAlertMessage({ type, ...basePayload }),
                { parse_mode: "HTML" }
            );

            console.log(`[ALERT 🔔] ${type} triggered at $${currentAsk} for user ${this.userId}`);

            if (type === "take_profit" || type === "stop_loss") {
                try {
                    // await this.config.onExecute?.();
                    console.log(`[EXEC ✅] onExecute() completed for ${type}`);
                } catch (err) {
                    console.error(`[EXEC ❌] Failed to execute onExecute() for ${type}:`, err);
                }
            }

            this.close();
        } catch (err) {
            console.error("[WS] Failed to handle book message:", err);
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

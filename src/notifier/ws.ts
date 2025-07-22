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
    | { type: "take_profit"; price: number; outcome?: string }
    | { type: "stop_loss"; price: number; outcome?: string }
    | { type: "alert_above"; price: number; outcome?: string }
    | { type: "alert_below"; price: number; outcome?: string };

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
    }

    private async onMessage(event: MessageEvent) {
        try {
            const data = JSON.parse(event.data.toString());
            if (data.event_type !== "price_change" || data.market !== this.marketId) return;

            const sellChanges = data.changes.filter((c: any) => c.side === "SELL");
            const bestAsk = sellChanges.reduce(
                (min: number, c: any) => Math.min(min, parseFloat(c.price)),
                Infinity
            );

            if (!isFinite(bestAsk) || this.hasTriggered) return;

            const question = await getMarketQuestion(this.marketId);
            const basePayload = {
                question: question || "Unknown Market",
                thresholdPrice: this.config.price,
                currentPrice: bestAsk,
                outcomeSide: this.config.outcome,
            };

            switch (this.config.type) {
                case "take_profit":
                    if (bestAsk >= this.config.price) {
                        this.hasTriggered = true;

                        await bot.telegram.sendMessage(
                            this.userId,
                            generatePriceAlertMessage({ type: "take_profit", ...basePayload }),
                            { parse_mode: "HTML" }
                        );

                        // await this.config.onExecute();
                        this.close();
                    }
                    break;

                case "stop_loss":
                    if (bestAsk <= this.config.price) {
                        this.hasTriggered = true;

                        await bot.telegram.sendMessage(
                            this.userId,
                            generatePriceAlertMessage({ type: "stop_loss", ...basePayload }),
                            { parse_mode: "HTML" }
                        );

                        // await this.config.onExecute();
                        this.close();
                    }
                    break;

                case "alert_above":
                    if (bestAsk >= this.config.price) {
                        this.hasTriggered = true;

                        await bot.telegram.sendMessage(
                            this.userId,
                            generatePriceAlertMessage({ type: "alert_above", ...basePayload }),
                            { parse_mode: "HTML" }
                        );

                        this.close();
                    }
                    break;

                case "alert_below":
                    if (bestAsk <= this.config.price) {
                        this.hasTriggered = true;

                        await bot.telegram.sendMessage(
                            this.userId,
                            generatePriceAlertMessage({ type: "alert_below", ...basePayload }),
                            { parse_mode: "HTML" }
                        );

                        this.close();
                    }
                    break;
            }

            console.log(`[WS] Price update: $${bestAsk.toFixed(4)} | Market: ${this.marketId}`);
        } catch (err) {
            console.error("[WS] Failed to handle price message:", err);
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

// new PolymarketMarketTradeWatcher(
//     "",
//     "64667957397757546515164546892040938377941653520792639389355873870925841226189",
//     "0x19a84fd0c80bc82212a9f96d9a5b5f983853cf493733c18a20c88a0fd53581ad",
//     {

//     }
// );

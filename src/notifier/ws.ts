import { POLYMARKET_WS_MARKET_URL, POLYMARKET_WS_USER_URL } from "@/shared/constants";
import {
    generateOrderFilledMessage,
    generatePriceAlertMessage,
    generateTPorSLMessage,
    getMarketQuestion,
} from "@/notifier/utils";
import { bot } from "@/bot";
import { getUserDetails } from "@/helpers/get-user-details";
import { buyOrderGTC } from "@/utils/polymarket-order/buy-order-gtc";
import { OrderType, Side } from "@polymarket/clob-client";
import { decryptPrivateKey } from "@/utils/crypto";
import { redisClient } from "@/lib/redis";

type Auth = {
    apiKey: string;
    secret: string;
    passphrase: string;
};

export type PriceWatchConfig =
    | { type: "take_profit"; price: number; outcome: string; size: number }
    | { type: "stop_loss"; price: number; outcome: string; size: number }
    | { type: "alert_above"; price: number; outcome: string }
    | { type: "alert_below"; price: number; outcome: string };

type WatcherKey = `${string}:${string}:${"above" | "below"}`; // userId:marketId:direction

const watchers = new Map<WatcherKey, PolymarketMarketTradeWatcher>();

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

            const { type, price } = this.config;
            let outcome;

            if (type === "alert_above" || type === "alert_below") {
                outcome = this.config.outcome;
            }

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

            if (type === "alert_above" || type === "alert_below") {
                try {
                    await bot.telegram.sendMessage(
                        this.userId,
                        generatePriceAlertMessage({ type, ...basePayload }),
                        { parse_mode: "HTML" }
                    );
                } catch (error) {
                    console.error("Failed to Send ALERT Message: ", error);
                }
            }

            if (type === "take_profit" || type === "stop_loss") {
                const user = await getUserDetails(Number(this.userId));

                if (!user) {
                    console.error("Error fetching User Details in TP/SL");
                    return;
                }

                const { response, error } = await buyOrderGTC({
                    price: this.lastBestAsk,
                    size: this.config.size,
                    orderType: OrderType.GTC,
                    tokenId: this.assetId,
                    side: Side.SELL,
                    feeRateBps: 0,
                    apiCreds: JSON.parse(user.api_credentials),
                    privateKey: decryptPrivateKey(user.private_key),
                });

                if (!response || error) {
                    console.error("ERROR EXECUTING TP/SL LIMIT ORDER: ", error);
                }

                const question = await getMarketQuestion(this.marketId);

                await bot.telegram.sendMessage(
                    this.userId,
                    generateTPorSLMessage({
                        type,
                        question: question || "Unknown Market",
                        thresholdPrice: price,
                        currentPrice: currentAsk,
                        outcomeSide: this.config.outcome,
                        size: this.config.size,
                    }),
                    {
                        parse_mode: "HTML",
                    }
                );
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

export async function storePriceAlertInRedis(
    userId: string,
    config: PriceWatchConfig,
    marketId: string,
    assetId: string
) {
    const direction = config.type === "alert_above" ? "above" : "below";
    const fullField = `${marketId}:${assetId}:${direction}`;
    const redisFieldKey = `user:price_alerts:${userId}`;
    const alertData = JSON.stringify({ ...config, marketId, assetId });

    await redisClient.hSet(redisFieldKey, fullField, alertData);
}

export function startPriceAlertWatcher(
    userId: string,
    marketId: string,
    assetId: string,
    config: PriceWatchConfig
) {
    const key: WatcherKey = `${userId}:${marketId}:${config.type === "alert_above" ? "above" : "below"}`;

    const existing = watchers.get(key);
    if (existing) {
        existing.close(); // stop previous watcher
    }

    const watcher = new PolymarketMarketTradeWatcher(userId, assetId, marketId, config);
    watchers.set(key, watcher);
}

export function stopPriceAlertWatcher(
    userId: string,
    marketId: string,
    direction: "above" | "below"
) {
    const key: WatcherKey = `${userId}:${marketId}:${direction}`;
    const watcher = watchers.get(key);

    if (watcher) {
        watcher.close();
        watchers.delete(key);
    }
}

export async function restoreWatchersFromRedis() {
    const keys = await redisClient.keys("user:price_alerts:*");

    for (const key of keys) {
        const userId = key.split(":")[2];
        const alerts = await redisClient.hGetAll(key);

        for (const [_, configStr] of Object.entries(alerts)) {
            const config = JSON.parse(configStr);
            startPriceAlertWatcher(userId, config.marketId, config.assetId, config);
        }
    }
}

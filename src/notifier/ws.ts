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
import { generatePnlCard } from "@/utils/card-generator";
import { getMarketByConditionId } from "@/utils/polymarket/get-markets";
import { capitalize } from "@/utils";
import { getUserPositionByMarket } from "@/utils/polymarket/get-user-position";

type Auth = {
    apiKey: string;
    secret: string;
    passphrase: string;
};

export type PriceWatchConfig =
    | { type: "take_profit"; price: number; outcome: string; size: number }
    | { type: "stop_loss"; price: number; outcome: string; size: number }
    | { type: "alert"; price: number; outcome: string };

type WatcherKey = `${string}:${string}`; // userId:marketId:direction

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
                const user = await getUserDetails(Number(this.userId));
                const market = await getMarketByConditionId(message.market);

                if (!user || !market) {
                    console.log("Error sending Limit Order Placed Message");
                    return;
                }

                let pnlType: "Positive" | "Negative" | "Neutral";

                const marketTitle = market.question || market.title;
                const side = capitalize(message.outcome.toLowerCase()) as "Yes" | "No";
                const volume = Math.floor(Number(market.volume)).toLocaleString("en-US");

                const closeDate = new Date().toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                });

                if (market.cashPnl > 0) pnlType = "Positive";
                else if (market.cashPnl < 0) pnlType = "Negative";
                else pnlType = "Neutral";

                const rawProfitAmount = parseFloat(Math.abs(market.cashPnl).toFixed(2));
                const entryPercentage = parseFloat((market.avgPrice * 100).toFixed(2));
                const exitPercentage = parseFloat((market.curPrice * 100).toFixed(2));

                const txtMessage = generateOrderFilledMessage(message, market.question);
                const imgBuffer = await generatePnlCard(
                    pnlType,
                    user.telegram_username,
                    marketTitle,
                    side,
                    volume,
                    closeDate,
                    rawProfitAmount,
                    entryPercentage,
                    exitPercentage,
                    user.show_username_in_cards
                );

                await bot.telegram.sendPhoto(this.userId, { source: imgBuffer });
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

            if (!Array.isArray(eventData) || eventData.length === 0) {
                return;
            }

            const data = eventData[0];

            if (!data || data.event_type !== "book") return;

            if (!data.asks || !Array.isArray(data.asks) || data.asks.length === 0) return;

            const asks = data.asks.map((a: any) => parseFloat(a.price)).filter(isFinite);

            if (asks.length === 0) return;

            const currentAsk = Math.min(...asks);

            if (!isFinite(currentAsk)) return;

            const { type, price } = this.config;
            let shouldTrigger = false;

            if (type === "alert") {
                shouldTrigger =
                    (this.lastBestAsk < price && currentAsk >= price) ||
                    (this.lastBestAsk > price && currentAsk <= price);
            } else if (type === "take_profit") {
                shouldTrigger = this.lastBestAsk < price && currentAsk > price;
            } else if (type === "stop_loss") {
                shouldTrigger = this.lastBestAsk > price && currentAsk < price;
            }

            this.lastBestAsk = currentAsk;

            if (!shouldTrigger) return;

            this.hasTriggered = true;

            const question = await getMarketQuestion(this.marketId);
            const basePayload = {
                question: question || "Unknown Market",
                thresholdPrice: price,
                currentPrice: currentAsk,
                outcomeSide: this.config.outcome,
            };

            if (type === "alert") {
                try {
                    await bot.telegram.sendMessage(
                        this.userId,
                        generatePriceAlertMessage({ type, ...basePayload }),
                        { parse_mode: "HTML" }
                    );
                    await stopPriceAlertWatcher(this.userId, this.marketId);
                } catch (error) {
                    console.error("Failed to Send ALERT Message: ", error);
                }
            } else {
                const user = await getUserDetails(Number(this.userId));
                if (!user) {
                    console.error("Error fetching User Details in TP/SL");
                    return;
                }

                const position = await getUserPositionByMarket(user.wallet_address, this.marketId);
                if (!position) {
                    await stopAllTpSlWatchers(
                        this.userId,
                        this.marketId,
                        this.config.type === "take_profit" ? "tp" : "sl"
                    );

                    return this.close();
                }

                const sizeToExecute = (this.config.size / 100) * position.size;

                const { response, error } = await buyOrderGTC({
                    price: this.lastBestAsk,
                    size: sizeToExecute,
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

                await bot.telegram.sendMessage(
                    this.userId,
                    generateTPorSLMessage({
                        question: question || "Unknown Market",
                        thresholdPrice: price,
                        currentPrice: currentAsk,
                        outcomeSide: this.config.outcome,
                        size: this.config.size,
                    }),
                    { parse_mode: "HTML" }
                );

                await stopAllTpSlWatchers(
                    this.userId,
                    this.marketId,
                    this.config.type === "take_profit" ? "tp" : "sl"
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
    const fullField = `${marketId}:${assetId}`;
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
    const key: WatcherKey = `${userId}:${marketId}`;

    const existing = watchers.get(key);
    if (existing) {
        existing.close(); // stop previous watcher
    }

    const watcher = new PolymarketMarketTradeWatcher(userId, assetId, marketId, config);
    watchers.set(key, watcher);
}

export function stopPriceAlertWatcher(userId: string, marketId: string) {
    const key: WatcherKey = `${userId}:${marketId}`;
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

export async function storeTpSlWatcherInRedis(
    userId: string,
    config: PriceWatchConfig,
    marketId: string,
    assetId: string
) {
    const fullField = `${marketId}:${assetId}`;
    const redisFieldKey = `user:tp_sl_watchers:${userId}`;
    const data = JSON.stringify({ ...config, marketId, assetId });

    await redisClient.hSet(redisFieldKey, fullField, data);
}

export function startTpSlWatcher(
    userId: string,
    marketId: string,
    assetId: string,
    config: PriceWatchConfig
) {
    const key: WatcherKey = `${userId}:${marketId}`;

    const existing = watchers.get(key);
    if (existing) {
        existing.close();
    }

    const watcher = new PolymarketMarketTradeWatcher(userId, assetId, marketId, config);
    watchers.set(key, watcher);
}

export function stopTpSlWatcher(userId: string, marketId: string) {
    const key: WatcherKey = `${userId}:${marketId}`;
    const watcher = watchers.get(key);

    if (watcher) {
        watcher.close();
        watchers.delete(key);
    }
}

export async function restoreTpSlWatchersFromRedis() {
    const keys = await redisClient.keys("user:tp_sl_watchers:*");

    for (const key of keys) {
        const userId = key.split(":")[2];
        const entries = await redisClient.hGetAll(key);

        for (const [_, configStr] of Object.entries(entries)) {
            const config = JSON.parse(configStr);
            startTpSlWatcher(userId, config.marketId, config.assetId, config);
        }
    }
}

export async function stopAllTpSlWatchers(
    userId: string,
    marketId: string,
    type: "tp" | "sl" | "all" = "all"
) {
    const tpSlKey = `user:tp_sl_watchers:${userId}`;
    const tpSlEntries = await redisClient.hGetAll(tpSlKey);

    const typeMap = {
        tp: "take_profit",
        sl: "stop_loss",
    };

    for (const [field, value] of Object.entries(tpSlEntries)) {
        const [storedMarketId] = field.split(":");

        if (storedMarketId === marketId) {
            try {
                const parsed = JSON.parse(value);

                if (
                    type === "all" || // delete everything
                    parsed.type === typeMap[type] // or delete matching type
                ) {
                    await redisClient.hDel(tpSlKey, field);
                    stopTpSlWatcher(userId, marketId);
                }
            } catch (err) {
                console.error(`Invalid JSON for field ${field}:`, err);
            }
        }
    }
}

import { Markup } from "telegraf";
import { bot } from "../../bot";
import { POLYMARKET_WS_MARKET_URL } from "../../shared/constants";
import { getMarketByConditionId } from "../../utils/polymarket/get-markets";
import { generatePriceAlertMessage, generateTPorSLMessage } from "../utils";
import { getUserDetails } from "../../helpers/get-user-details";
import { getUserPositionByMarket } from "../../utils/polymarket/get-user-position";
import { buyOrderGTC } from "../../utils/polymarket-order/buy-order-gtc";
import { OrderType, Side } from "@polymarket/clob-client";
import { decryptPrivateKey } from "../../utils/crypto";
import { redisClient } from "../../lib/redis";
import {
    updateUserMarketsTraded,
    updateUserTransactionsExecuted,
} from "../../bot/utils/database/update-user-data";

export type PriceWatchConfig =
    | { type: "take_profit"; price: number; outcome: string; size: number }
    | { type: "stop_loss"; price: number; outcome: string; size: number }
    | { type: "alert"; price: number; outcome: string };

const EPSILON = 0.00001;
const ALERT_REDIS_KEY_PREFIX = "user:price_alerts:";
const TPSL_REDIS_KEY_PREFIX = "user:tp_sl_watchers:";

const activeWatchers = new Map<string, PolymarketMarketTradeWatcher>();

export class PolymarketMarketTradeWatcher {
    private socket: WebSocket;
    private userId: string;
    private assetId: string;
    private marketId: string;
    private config: PriceWatchConfig;
    public hasTriggered = false;
    private lastBestAsk: number = Infinity;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private reconnectDelay = 3000;

    constructor(userId: string, assetId: string, marketId: string, config: PriceWatchConfig) {
        this.userId = userId;
        this.assetId = assetId;
        this.marketId = marketId;
        this.config = config;

        this.socket = new WebSocket(POLYMARKET_WS_MARKET_URL);
        this.registerHandlers();

        // Store in Redis
        if (config.type === "alert") {
            storePriceAlertInRedis(userId, config, marketId, assetId).catch(console.error);
        } else {
            storeTpSlWatcherInRedis(userId, config, marketId, assetId).catch(console.error);
        }

        const key = `${userId}:${marketId}:${assetId}:${config.type}`;
        activeWatchers.set(key, this);
    }

    private registerHandlers() {
        this.socket.onopen = () => this.onOpen();
        this.socket.onmessage = (event) => this.onMessage(event);
        this.socket.onerror = (event) => this.onError(event);
        this.socket.onclose = (event) => this.onClose(event);
    }

    private onOpen() {
        this.socket.send(
            JSON.stringify({
                type: "market",
                assets_ids: [this.assetId],
            })
        );
        console.log(
            `[START] New ${this.config.type === "alert" ? "Price Alert" : this.config.type === "take_profit" ? "Take Profit" : "Stop Loss"} WS Connection:`,
            this.assetId
        );
    }

    private async onMessage(event: MessageEvent) {
        if (this.hasTriggered) return;

        try {
            const eventData = JSON.parse(event.data.toString());
            const data = eventData[0];
            if (!data || data.event_type !== "book" || !Array.isArray(data.asks)) return;

            const asks = data.asks.map((a: any) => parseFloat(a.price)).filter(isFinite);
            if (!asks.length) return;

            const currentAsk = Math.min(...asks);

            const { type, price } = this.config;
            let shouldTrigger = false;

            if (type === "alert") {
                shouldTrigger = Math.abs(currentAsk - price) < EPSILON;
            } else if (type === "take_profit") {
                shouldTrigger = this.lastBestAsk < price && currentAsk > price;
            } else if (type === "stop_loss") {
                shouldTrigger = this.lastBestAsk > price && currentAsk < price;
            }

            this.lastBestAsk = currentAsk;

            if (!shouldTrigger) return;

            this.hasTriggered = true;

            const market = (await getMarketByConditionId(this.marketId))[0];

            const basePayload = {
                question: market?.question || "Unknown Market",
                thresholdPrice: price,
                currentPrice: currentAsk,
                outcomeSide: this.config.outcome,
            };

            if (type === "alert") {
                await bot.telegram.sendMessage(
                    this.userId,
                    generatePriceAlertMessage({ type, ...basePayload }),
                    {
                        parse_mode: "HTML",
                        reply_markup: Markup.inlineKeyboard([
                            Markup.button.callback("View this Market", `view_market:${market.id}`),
                        ]).reply_markup,
                    }
                );
                stopPriceAlertWatcher(this.userId, this.marketId, this.assetId);
            } else {
                const user = await getUserDetails(Number(this.userId));
                if (!user) return;

                const position = await getUserPositionByMarket(user.wallet_address, this.marketId);
                if (!position) {
                    return stopAllTpSlWatchers(
                        this.userId,
                        this.marketId,
                        type === "take_profit" ? "tp" : "sl"
                    );
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

                await Promise.all([
                    updateUserMarketsTraded(Number(this.userId), user.markets_traded),
                    updateUserTransactionsExecuted(Number(this.userId), user.txns_executed),
                    bot.telegram.sendMessage(
                        this.userId,
                        generateTPorSLMessage({ ...basePayload, size: this.config.size }),
                        { parse_mode: "HTML" }
                    ),
                ]);

                stopTpSlWatcher(this.userId, this.marketId, this.assetId, type);
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

        if (!this.hasTriggered) {
            this.reconnectTimeout = setTimeout(() => {
                console.log(
                    `[WS] Reconnecting watcher for ${this.userId}:${this.marketId}:${this.assetId}`
                );
                this.socket = new WebSocket(POLYMARKET_WS_MARKET_URL);
                this.registerHandlers();
            }, this.reconnectDelay);
        }
    }

    public close() {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.socket.close();

        const key = `${this.userId}:${this.marketId}:${this.assetId}:${this.config.type}`;
        activeWatchers.delete(key);

        const redisKey =
            this.config.type === "alert"
                ? `${ALERT_REDIS_KEY_PREFIX}${this.userId}`
                : `${TPSL_REDIS_KEY_PREFIX}${this.userId}`;

        const field = `${this.marketId}:${this.assetId}`;

        redisClient.hDel(redisKey, field).catch((err) => {
            console.error(`[Watcher] Failed to remove Redis key: ${redisKey} ${field}`, err);
        });
    }

    public isAlive(): boolean {
        return this.socket.readyState === WebSocket.OPEN;
    }
}

export function startPriceAlertWatcher(
    userId: string,
    marketId: string,
    assetId: string,
    config: PriceWatchConfig
) {
    const key = `${userId}:${marketId}:${assetId}:${config.type}`;
    if (activeWatchers.has(key)) return;

    new PolymarketMarketTradeWatcher(userId, assetId, marketId, config);
}

export function stopPriceAlertWatcher(userId: string, marketId: string, assetId: string) {
    const key = `${userId}:${marketId}:${assetId}:alert`;
    const watcher = activeWatchers.get(key);

    if (watcher) watcher.close();
}

export function startTpSlWatcher(
    userId: string,
    marketId: string,
    assetId: string,
    config: PriceWatchConfig
) {
    const key = `${userId}:${marketId}:${assetId}:${config.type}`;
    if (activeWatchers.has(key)) return;

    new PolymarketMarketTradeWatcher(userId, assetId, marketId, config);
}

export function stopTpSlWatcher(
    userId: string,
    marketId: string,
    assetId: string,
    type: "take_profit" | "stop_loss"
) {
    const key = `${userId}:${marketId}:${assetId}:${type}`;
    const watcher = activeWatchers.get(key);

    if (watcher) watcher.close();
}

export async function restorePriceWatchersFromRedis() {
    activeWatchers.clear();

    const keys = await redisClient.keys(`${ALERT_REDIS_KEY_PREFIX}*`);
    for (const key of keys) {
        const userId = key.split(":")[2];
        const alerts = await redisClient.hGetAll(key);

        for (const [_, configStr] of Object.entries(alerts)) {
            const config = JSON.parse(configStr);
            startPriceAlertWatcher(userId, config.marketId, config.assetId, config);
        }
    }
}

export async function restoreTpSlWatchersFromRedis() {
    activeWatchers.clear();

    const keys = await redisClient.keys(`${TPSL_REDIS_KEY_PREFIX}*`);
    for (const key of keys) {
        const userId = key.split(":")[2];
        const entries = await redisClient.hGetAll(key);

        for (const [_, configStr] of Object.entries(entries)) {
            const config = JSON.parse(configStr);
            startTpSlWatcher(userId, config.marketId, config.assetId, config);
        }
    }
}

export async function storePriceAlertInRedis(
    userId: string,
    config: PriceWatchConfig,
    marketId: string,
    assetId: string
) {
    const key = `${ALERT_REDIS_KEY_PREFIX}${userId}`;
    const field = `${marketId}:${assetId}`;
    const value = JSON.stringify({ ...config, marketId, assetId });
    await redisClient.hSet(key, field, value);
}

export async function storeTpSlWatcherInRedis(
    userId: string,
    config: PriceWatchConfig,
    marketId: string,
    assetId: string
) {
    const key = `${TPSL_REDIS_KEY_PREFIX}${userId}`;
    const field = `${marketId}:${assetId}:${config.type}`;
    const value = JSON.stringify({ ...config, marketId, assetId });
    await redisClient.hSet(key, field, value);
}

export async function stopAllTpSlWatchers(
    userId: string,
    marketId: string,
    type: "tp" | "sl" | "all" = "all"
) {
    const redisKey = `${TPSL_REDIS_KEY_PREFIX}${userId}`;
    const entries = await redisClient.hGetAll(redisKey);

    const typeMap = {
        tp: "take_profit",
        sl: "stop_loss",
    };

    for (const [field, _] of Object.entries(entries)) {
        const [storedMarketId, assetId, typeStr] = field.split(":");
        if (storedMarketId !== marketId) continue;

        try {
            if (type === "all" || typeMap[type] === typeStr) {
                await redisClient.hDel(redisKey, field);
                stopTpSlWatcher(
                    userId,
                    storedMarketId,
                    assetId,
                    typeStr as "take_profit" | "stop_loss"
                );
            }
        } catch (err) {
            console.error(`Invalid JSON for field ${field}:`, err);
        }
    }
}

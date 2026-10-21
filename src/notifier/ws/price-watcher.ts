import { Markup } from "telegraf";
import { bot } from "../../bot";
import { POLYMARKET_WS_MARKET_URL } from "../../shared/constants";
import { getMarketByConditionId } from "../../utils/polymarket/get-markets";
import {
    generatePriceAlertMessage,
    generateTPorSLFailedMessage,
    generateTPorSLMessage,
} from "../utils";
import { getUserDetails } from "../../helpers/get-user-details";
import { getUserPosition } from "../../utils/polymarket/get-user-position";
import { marketSellOrder } from "../../utils/polymarket-order/market-buy-order";
import { OrderType } from "@polymarket/clob-client";
import { decryptPrivateKey } from "../../utils/crypto";
import { redisClient } from "../../lib/redis";
import { evaluateTrigger } from "./triggers";
import {
    updateUserMarketsTraded,
    updateUserTransactionsExecuted,
} from "../../bot/utils/database/update-user-data";

export type PriceWatchConfig =
    | { type: "take_profit"; price: number; outcome: string; size: number }
    | { type: "stop_loss"; price: number; outcome: string; size: number }
    | { type: "alert"; price: number; outcome: string };

const ALERT_REDIS_KEY_PREFIX = "user:price_alerts:";
const TPSL_REDIS_KEY_PREFIX = "user:tp_sl_watchers:";

const activeWatchers = new Map<string, PolymarketMarketTradeWatcher>();

const alertField = (marketId: string, assetId: string) => `${marketId}:${assetId}`;

const tpSlField = (marketId: string, assetId: string, type: string) =>
    `${marketId}:${assetId}:${type}`;

export class PolymarketMarketTradeWatcher {
    private socket: WebSocket;
    private userId: string;
    private assetId: string;
    private marketId: string;
    private config: PriceWatchConfig;
    public hasTriggered = false;
    private lastBestAsk: number | null = null;
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
        // console.log(
        //     `[START] New ${this.config.type === "alert" ? "Price Alert" : this.config.type === "take_profit" ? "Take Profit" : "Stop Loss"} WS Connection:`,
        //     this.assetId
        // );
    }

    private async onMessage(event: MessageEvent) {
        if (this.hasTriggered) return;

        try {
            const eventData = JSON.parse(event.data.toString());
            const data = eventData[0];
            if (!data || data.event_type !== "book") return;

            const { type, price } = this.config;
            const { shouldTrigger, currentPrice, lastBestAsk } = evaluateTrigger(
                this.config,
                data,
                this.lastBestAsk
            );

            this.lastBestAsk = lastBestAsk;

            if (!shouldTrigger || currentPrice === undefined) return;

            this.hasTriggered = true;

            const market = await getMarketByConditionId(this.marketId);

            const basePayload = {
                question: market?.question || "Unknown Market",
                thresholdPrice: price,
                currentPrice,
                outcomeSide: this.config.outcome,
            };

            if (type === "alert") {
                await bot.telegram.sendMessage(
                    this.userId,
                    generatePriceAlertMessage({ type, ...basePayload }),
                    {
                        parse_mode: "HTML",
                        reply_markup: market
                            ? Markup.inlineKeyboard([
                                  Markup.button.callback(
                                      "View this Market",
                                      `view_market:${market.id}`
                                  ),
                              ]).reply_markup
                            : undefined,
                    }
                );
                stopPriceAlertWatcher(this.userId, this.marketId, this.assetId);
            } else {
                const user = await getUserDetails(Number(this.userId));
                if (!user) return;

                // A market has two outcome tokens, so match on the asset, not the condition id
                const positions = await getUserPosition({ user: user.wallet_address });
                const position = positions.find((p) => p.asset === this.assetId);

                if (!position || position.size <= 0) {
                    return stopTpSlWatcher(this.userId, this.marketId, this.assetId, type);
                }

                const sharesToSell = (this.config.size / 100) * position.size;

                // FAK sells whatever the book can absorb now instead of resting at a stale price
                const { response, error } = await marketSellOrder({
                    privateKey: decryptPrivateKey(user.private_key),
                    creds: JSON.parse(user.api_credentials),
                    tokenId: this.assetId,
                    amount: sharesToSell,
                    orderType: OrderType.FAK,
                });

                if (!response || error) {
                    console.error("[WS] Failed to execute TP/SL sell:", error);

                    await bot.telegram.sendMessage(
                        this.userId,
                        generateTPorSLFailedMessage({ type, ...basePayload }),
                        { parse_mode: "HTML" }
                    );
                } else {
                    await Promise.all([
                        updateUserMarketsTraded(Number(this.userId), user.markets_traded),
                        updateUserTransactionsExecuted(Number(this.userId), user.txns_executed),
                        bot.telegram.sendMessage(
                            this.userId,
                            generateTPorSLMessage({ type, ...basePayload, shares: sharesToSell }),
                            { parse_mode: "HTML" }
                        ),
                    ]);
                }

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

    private onClose(_event: CloseEvent) {
        // console.warn(`[WS] WebSocket closed: ${event.code} ${event.reason}`);

        if (!this.hasTriggered) {
            this.reconnectTimeout = setTimeout(() => {
                // console.log(
                //     `[WS] Reconnecting watcher for ${this.userId}:${this.marketId}:${this.assetId}`
                // );
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

        const field =
            this.config.type === "alert"
                ? alertField(this.marketId, this.assetId)
                : tpSlField(this.marketId, this.assetId, this.config.type);

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
    const field = alertField(marketId, assetId);
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
    const field = tpSlField(marketId, assetId, config.type);
    const value = JSON.stringify({ ...config, marketId, assetId });
    await redisClient.hSet(key, field, value);
}

export async function stopAllTpSlWatchers(
    userId: string,
    marketId: string,
    type: "tp" | "sl" | "all" = "all",
    assetId?: string
) {
    const redisKey = `${TPSL_REDIS_KEY_PREFIX}${userId}`;
    const entries = await redisClient.hGetAll(redisKey);

    const typeMap = {
        tp: "take_profit",
        sl: "stop_loss",
    };

    for (const [field, _] of Object.entries(entries)) {
        const [storedMarketId, storedAssetId, typeStr] = field.split(":");
        if (storedMarketId !== marketId) continue;
        if (assetId && storedAssetId !== assetId) continue;

        try {
            if (type === "all" || typeMap[type] === typeStr) {
                await redisClient.hDel(redisKey, field);
                stopTpSlWatcher(
                    userId,
                    storedMarketId,
                    storedAssetId,
                    typeStr as "take_profit" | "stop_loss"
                );
            }
        } catch (err) {
            console.error(`Invalid JSON for field ${field}:`, err);
        }
    }
}

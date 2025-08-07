import type { ApiKeyCreds } from "../../types/polymarket";

import { bot } from "../../bot";
import { getUserDetails } from "../../helpers/get-user-details";
import { POLYMARKET_WS_USER_URL } from "../../shared/constants";
import { capitalize } from "../../utils";
import { generatePnlCard } from "../../utils/card-generator";
import { getMarketByConditionId } from "../../utils/polymarket/get-markets";
import { generateOrderFilledMessage } from "../utils";
import { redisClient } from "../../lib/redis";

const TRADE_WATCHER_KEY_PREFIX = "user:trade_watchers:";

const activeUserTradeWatchers = new Map<string, PolymarketUserTradeWatcher>();

class PolymarketUserTradeWatcher {
    private socket: WebSocket;
    private userId: string;
    private marketId: string;
    private auth: ApiKeyCreds;
    private hasTriggered = false;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private reconnectDelay = 3000;

    constructor(userId: string, auth: ApiKeyCreds, marketId: string) {
        this.userId = userId;
        this.marketId = marketId;
        this.auth = auth;

        this.socket = new WebSocket(POLYMARKET_WS_USER_URL);
        this.registerHandlers();

        // Persist to Redis
        storeUserTradeWatcherInRedis(userId, marketId, auth).catch(console.error);
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
        console.log("[START] New Limit Order WS Connection:", `${this.userId}:${this.marketId}`);
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
                this.hasTriggered = true;

                const user = await getUserDetails(Number(this.userId));
                const market = await getMarketByConditionId(message.market);
                if (!user || !market) return;

                const txtMessage = generateOrderFilledMessage(message, market.question);
                const imgBuffer = await generatePnlCard(
                    market.cashPnl > 0 ? "Positive" : market.cashPnl < 0 ? "Negative" : "Neutral",
                    user.telegram_username,
                    market.question || market.title,
                    capitalize(message.outcome.toLowerCase()) as "Yes" | "No",
                    Math.floor(Number(market.volume)).toLocaleString("en-US"),
                    new Date().toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                    }),
                    parseFloat(Math.abs(market.cashPnl).toFixed(2)),
                    parseFloat((market.avgPrice * 100).toFixed(2)),
                    parseFloat((market.curPrice * 100).toFixed(2)),
                    user.show_username_in_cards
                );

                await bot.telegram.sendPhoto(this.userId, { source: imgBuffer });
                await bot.telegram.sendMessage(this.userId, txtMessage, {
                    parse_mode: "Markdown",
                });

                await stopUserTradeWatcher(this.userId, this.marketId);
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

        if (!this.hasTriggered) {
            this.reconnectTimeout = setTimeout(() => {
                console.log(`[WS] Reconnecting user watcher for ${this.userId}:${this.marketId}`);
                this.socket = new WebSocket(POLYMARKET_WS_USER_URL);
                this.registerHandlers();
            }, this.reconnectDelay);
        } else {
            stopUserTradeWatcher(this.userId, this.marketId).catch(console.error);
        }
    }

    public close() {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.socket.close();
    }

    public isAlive(): boolean {
        return this.socket.readyState === WebSocket.OPEN;
    }
}

async function storeUserTradeWatcherInRedis(userId: string, marketId: string, auth: ApiKeyCreds) {
    const redisKey = `${TRADE_WATCHER_KEY_PREFIX}${userId}`;
    const field = marketId;
    const value = JSON.stringify({ marketId, auth });

    await redisClient.hSet(redisKey, field, value);
}

export async function restoreUserTradeWatchers() {
    const keys = await redisClient.keys(`${TRADE_WATCHER_KEY_PREFIX}*`);

    for (const key of keys) {
        const userId = key.split(":")[2];
        const entries = await redisClient.hGetAll(key);

        for (const [marketId, configStr] of Object.entries(entries)) {
            const config = JSON.parse(configStr);
            startUserTradeWatcher(userId, config.auth, marketId);
        }
    }
}

export function startUserTradeWatcher(userId: string, auth: ApiKeyCreds, marketId: string) {
    const key = `${userId}:${marketId}`;
    if (activeUserTradeWatchers.has(key)) return;

    const watcher = new PolymarketUserTradeWatcher(userId, auth, marketId);
    activeUserTradeWatchers.set(key, watcher);
}

async function stopUserTradeWatcher(userId: string, marketId: string) {
    const key = `${userId}:${marketId}`;
    const watcher = activeUserTradeWatchers.get(key);
    if (watcher) {
        watcher.close(); // this also clears reconnectTimeout
        activeUserTradeWatchers.delete(key);
    }

    const redisKey = `${TRADE_WATCHER_KEY_PREFIX}${userId}`;
    await redisClient.hDel(redisKey, marketId);
}

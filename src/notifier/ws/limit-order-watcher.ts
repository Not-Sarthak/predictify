import type { ApiKeyCreds } from "../../types/polymarket";
import type { TableRow } from "../../types/supabase/tables";

import { ClobClient } from "@polymarket/clob-client";
import { ethers } from "ethers";
import { bot } from "../../bot";
import { getUserDetails } from "../../helpers/get-user-details";
import { CHAIN_ID, HOST, POLYMARKET_WS_USER_URL } from "../../shared/constants";
import { capitalize, createLegacyWallet } from "../../utils";
import { generatePnlCard } from "../../utils/card-generator";
import {
    decryptApiCredentials,
    decryptPrivateKey,
    encryptApiCredentials,
} from "../../utils/crypto";
import { transferFeeToTreasury } from "../../utils/fees/fee";
import { getMarketByConditionId } from "../../utils/polymarket/get-markets";
import { getUserPosition } from "../../utils/polymarket/get-user-position";
import { updateUserDepositAndFees } from "../../bot/utils/database/update-user-data";
import { generateOrderFilledMessage } from "../utils";
import { redisClient } from "../../lib/redis";
import { getUserFills, type UserFill, type WsTradeMessage } from "./fills";

const TRADE_WATCHER_KEY_PREFIX = "user:trade_watchers:";
const HANDLED_TRADE_KEY_PREFIX = "user:handled_trades:";
const HANDLED_TRADE_TTL_SECONDS = 7 * 24 * 60 * 60;

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
        // console.log("[START] New Limit Order WS Connection:", `${this.userId}:${this.marketId}`);
    }

    private async onMessage(event: MessageEvent) {
        try {
            const data = JSON.parse(event.data.toString());
            const message = data[0];

            if (
                message?.status !== "CONFIRMED" ||
                message.event_type !== "trade" ||
                message.market !== this.marketId
            ) {
                return;
            }

            // A reconnect can deliver the same trade again; each one is handled once
            const isNewTrade = await redisClient.set(
                `${HANDLED_TRADE_KEY_PREFIX}${this.userId}:${message.id}`,
                "1",
                { NX: true, EX: HANDLED_TRADE_TTL_SECONDS }
            );
            if (isNewTrade !== "OK") return;

            const user = await getUserDetails(Number(this.userId));
            if (!user) return;

            const privateKey = decryptPrivateKey(user.private_key);

            for (const fill of getUserFills(message as WsTradeMessage, this.auth.key)) {
                await this.notifyFill(user, fill, message.transaction_hash);

                // Resting buys aren't charged at placement, so the fee is taken on each fill
                if (fill.side === "BUY") {
                    const amount = fill.shares * fill.price;

                    await updateUserDepositAndFees(Number(this.userId), amount);
                    await transferFeeToTreasury({
                        userWallet: new ethers.Wallet(privateKey),
                        positionAmount: amount,
                        transactionType: "OPEN",
                        userId: Number(this.userId),
                    });
                }
            }

            // A partial fill leaves the order on the book, so keep watching until nothing in
            // this market is still open
            const clobClient = new ClobClient(
                HOST,
                CHAIN_ID,
                createLegacyWallet(new ethers.Wallet(privateKey)) as any,
                this.auth
            );
            const openOrders = await clobClient.getOpenOrders({ market: this.marketId });

            if (!openOrders.length) {
                this.hasTriggered = true;
                await stopUserTradeWatcher(this.userId, this.marketId);
            }
        } catch (err) {
            console.error("[WS] Failed to parse or handle message:", err);
        }
    }

    private async notifyFill(user: TableRow<"Users">, fill: UserFill, transactionHash?: string) {
        const [market, positions] = await Promise.all([
            getMarketByConditionId(this.marketId),
            getUserPosition({ user: user.wallet_address }),
        ]);

        const question = market?.question || "Unknown Market";
        const position = positions.find((p) => p.asset === fill.assetId);

        // The PnL comes from the user's position; the gamma market object has no PnL fields
        if (position) {
            const imgBuffer = await generatePnlCard(
                position.cashPnl > 0 ? "Positive" : position.cashPnl < 0 ? "Negative" : "Neutral",
                user.telegram_username,
                question,
                capitalize(fill.outcome.toLowerCase()) as "Yes" | "No",
                Math.floor(Number(market?.volume ?? 0)).toLocaleString("en-US"),
                new Date().toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                }),
                parseFloat(Math.abs(position.cashPnl).toFixed(2)),
                parseFloat((position.avgPrice * 100).toFixed(2)),
                parseFloat((position.curPrice * 100).toFixed(2)),
                user.show_username_in_cards
            );

            await bot.telegram.sendPhoto(this.userId, { source: imgBuffer });
        }

        await bot.telegram.sendMessage(
            this.userId,
            generateOrderFilledMessage(fill, question, transactionHash),
            { parse_mode: "HTML" }
        );
    }

    private onError(event: Event) {
        console.error("[WS] WebSocket error:", event);
    }

    private onClose(_event: CloseEvent) {
        // console.warn(`[WS] WebSocket closed: ${event.code} ${event.reason}`);

        if (!this.hasTriggered) {
            this.reconnectTimeout = setTimeout(() => {
                // console.log(`[WS] Reconnecting user watcher for ${this.userId}:${this.marketId}`);
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
    const value = JSON.stringify({ marketId, auth: encryptApiCredentials(auth) });

    await redisClient.hSet(redisKey, field, value);
}

export async function restoreUserTradeWatchers() {
    const keys = await redisClient.keys(`${TRADE_WATCHER_KEY_PREFIX}*`);

    for (const key of keys) {
        const userId = key.split(":")[2];
        const entries = await redisClient.hGetAll(key);

        for (const [marketId, configStr] of Object.entries(entries)) {
            const config = JSON.parse(configStr);

            // Entries written before credentials were encrypted hold the plain object
            const auth =
                typeof config.auth === "string" ? decryptApiCredentials(config.auth) : config.auth;

            startUserTradeWatcher(userId, auth, marketId);
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

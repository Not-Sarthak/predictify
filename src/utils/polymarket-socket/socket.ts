import { WebSocketServer, WebSocket } from "ws";
import { createWalletMonitor, enableWatch, disableWatch, getStatus } from "./wallet-monitor";
import type { MonitorState } from "./wallet-monitor";
import { supabase } from "../../lib/supabase";
import { bot } from "../../bot";
import { SOCKET_SERVER_PORT } from "../../shared/constants";

interface SocketClient {
    ws: WebSocket;
    userId: string;
    isAlive: boolean;
    watchedWallets: Set<string>;
}

interface WalletSubscription {
    userId: string;
    walletAddress: string;
    monitorState: MonitorState;
    lastActivity: Date;
}

interface SocketMessage {
    type: "START_WATCHING" | "STOP_WATCHING" | "GET_STATUS" | "PING" | "PONG";
    payload?: {
        walletAddress?: string;
        userId?: string;
    };
}

class WalletSocketServer {
    private wss: WebSocketServer;
    private clients: Map<string, SocketClient> = new Map();
    private walletSubscriptions: Map<string, WalletSubscription> = new Map();
    private globalMonitorState: MonitorState;
    private heartbeatInterval: NodeJS.Timeout | null = null;

    constructor(port: number = Number(SOCKET_SERVER_PORT)) {
        this.wss = new WebSocketServer({ port });
        this.globalMonitorState = createWalletMonitor();

        console.log(`🚀 WebSocket Server Started on Port ${port}`);
        this.setupEventHandlers();
        this.startHeartbeat();
    }

    private setupEventHandlers(): void {
        this.wss.on("connection", (ws: WebSocket, request) => {
            const userId = this.extractUserIdFromRequest(request);

            if (!userId) {
                ws.close(1008, "Missing user ID");
                return;
            }

            this.handleNewConnection(ws, userId);
        });

        this.wss.on("error", (error) => {
            console.error("❌ WebSocket Server Error:", error);
        });
    }

    private extractUserIdFromRequest(request: any): string | null {
        const url = new URL(request.url || "", "ws://localhost");
        return url.searchParams.get("userId");
    }

    private handleNewConnection(ws: WebSocket, userId: string): void {
        console.log(`👤 New connection: User ${userId}`);

        const client: SocketClient = {
            ws,
            userId,
            isAlive: true,
            watchedWallets: new Set(),
        };

        this.clients.set(userId, client);

        this.loadUserWatchedWallets(userId);

        this.setupClientEventHandlers(client);
        this.sendToClient(userId, {
            type: "GET_STATUS",
            payload: { status: getStatus(this.globalMonitorState) },
        });
    }

    private setupClientEventHandlers(client: SocketClient): void {
        const { ws, userId } = client;

        ws.on("message", (data: Buffer) => {
            try {
                const message: SocketMessage = JSON.parse(data.toString());
                this.handleClientMessage(userId, message);
            } catch (error) {
                console.error(`❌ Invalid message from user ${userId}:`, error);
                this.sendError(userId, "Invalid message format");
            }
        });

        ws.on("close", () => {
            console.log(`👋 User ${userId} disconnected`);
            this.handleClientDisconnect(userId);
        });

        ws.on("error", (error) => {
            console.error(`❌ Client error for user ${userId}:`, error);
            this.handleClientDisconnect(userId);
        });

        ws.on("pong", () => {
            client.isAlive = true;
        });
    }

    private async handleClientMessage(userId: string, message: SocketMessage): Promise<void> {
        const client = this.clients.get(userId);
        if (!client) return;

        switch (message.type) {
            case "START_WATCHING":
                await this.handleStartWatching(userId, message.payload?.walletAddress);
                break;

            case "STOP_WATCHING":
                await this.handleStopWatching(userId, message.payload?.walletAddress);
                break;

            case "GET_STATUS":
                this.sendStatus(userId);
                break;

            case "PING":
                this.sendToClient(userId, { type: "PONG" });
                break;

            default:
                this.sendError(userId, "Unknown message type");
        }
    }

    private async handleStartWatching(userId: string, walletAddress?: string): Promise<void> {
        if (!walletAddress || !this.isValidWalletAddress(walletAddress)) {
            this.sendError(userId, "Invalid wallet address");
            return;
        }

        const client = this.clients.get(userId);
        if (!client) return;

        if (client.watchedWallets.size >= 3) {
            this.sendError(userId, "Maximum 3 wallets allowed per user");
            return;
        }

        if (client.watchedWallets.has(walletAddress)) {
            this.sendError(userId, "Wallet already being watched");
            return;
        }

        try {
            await this.saveWalletSubscription(userId, walletAddress);

            client.watchedWallets.add(walletAddress);

            const subscription: WalletSubscription = {
                userId,
                walletAddress,
                monitorState: createWalletMonitor(),
                lastActivity: new Date(),
            };

            this.walletSubscriptions.set(`${userId}:${walletAddress}`, subscription);

            const allWatchedWallets = Array.from(client.watchedWallets);
            enableWatch(subscription.monitorState, [walletAddress]);

            this.sendToClient(userId, {
                type: "START_WATCHING",
                payload: {
                    walletAddress,
                    status: "success",
                    message: `Started watching wallet ${walletAddress}`,
                    totalWatched: client.watchedWallets.size,
                },
            });

            this.sendTelegramNotification(
                userId,
                `🔍 Started monitoring wallet: \`${walletAddress}\``
            );

            console.log(`✅ User ${userId} started watching wallet ${walletAddress}`);
        } catch (error) {
            console.error(`❌ Error starting watch for user ${userId}:`, error);
            this.sendError(userId, "Failed to start watching wallet");
        }
    }

    private async handleStopWatching(userId: string, walletAddress?: string): Promise<void> {
        if (!walletAddress) {
            this.sendError(userId, "Wallet address required");
            return;
        }

        const client = this.clients.get(userId);
        if (!client) return;

        if (!client.watchedWallets.has(walletAddress)) {
            this.sendError(userId, "Wallet not being watched");
            return;
        }

        try {
            await this.removeWalletSubscription(userId, walletAddress);

            client.watchedWallets.delete(walletAddress);

            const subscriptionKey = `${userId}:${walletAddress}`;
            const subscription = this.walletSubscriptions.get(subscriptionKey);

            if (subscription) {
                disableWatch(subscription.monitorState);
                this.walletSubscriptions.delete(subscriptionKey);
            }

            this.sendToClient(userId, {
                type: "STOP_WATCHING",
                payload: {
                    walletAddress,
                    status: "success",
                    message: `Stopped watching wallet ${walletAddress}`,
                    totalWatched: client.watchedWallets.size,
                },
            });

            this.sendTelegramNotification(
                userId,
                `🛑 Stopped monitoring wallet: \`${walletAddress}\``
            );

            console.log(`🛑 User ${userId} stopped watching wallet ${walletAddress}`);
        } catch (error) {
            console.error(`❌ Error stopping watch for user ${userId}:`, error);
            this.sendError(userId, "Failed to stop watching wallet");
        }
    }

    private sendStatus(userId: string): void {
        const client = this.clients.get(userId);
        if (!client) return;

        const watchedWallets = Array.from(client.watchedWallets);

        this.sendToClient(userId, {
            type: "GET_STATUS",
            payload: {
                status: getStatus(this.globalMonitorState),
                watchedWallets,
                totalWatched: watchedWallets.length,
                maxWallets: 3,
            },
        });
    }

    private sendToClient(userId: string, message: any): void {
        const client = this.clients.get(userId);
        if (!client || client.ws.readyState !== WebSocket.OPEN) return;

        try {
            client.ws.send(JSON.stringify(message));
        } catch (error) {
            console.error(`❌ Error sending message to user ${userId}:`, error);
        }
    }

    private sendError(userId: string, error: string): void {
        this.sendToClient(userId, {
            type: "ERROR",
            payload: { error },
        });
    }

    private async sendTelegramNotification(userId: string, message: string): Promise<void> {
        try {
            await bot.telegram.sendMessage(userId, message, {
                parse_mode: "Markdown",
            });
        } catch (error) {
            console.error(`❌ Failed to send Telegram notification to user ${userId}:`, error);
        }
    }

    private handleClientDisconnect(userId: string): void {
        const client = this.clients.get(userId);
        if (!client) return;

        client.watchedWallets.forEach((walletAddress) => {
            const subscriptionKey = `${userId}:${walletAddress}`;
            const subscription = this.walletSubscriptions.get(subscriptionKey);

            if (subscription) {
                disableWatch(subscription.monitorState);
                this.walletSubscriptions.delete(subscriptionKey);
            }
        });

        this.clients.delete(userId);
    }

    private startHeartbeat(): void {
        this.heartbeatInterval = setInterval(() => {
            this.clients.forEach((client, userId) => {
                if (!client.isAlive) {
                    console.log(`💀 Client ${userId} failed heartbeat check`);
                    client.ws.terminate();
                    this.handleClientDisconnect(userId);
                    return;
                }

                client.isAlive = false;
                client.ws.ping();
            });
        }, 30000);
    }

    private isValidWalletAddress(address: string): boolean {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }

    private async loadUserWatchedWallets(userId: string): Promise<void> {
        try {
            const { data: watchedWallets, error } = await supabase
                .from("wallet_subscriptions")
                .select("wallet_address")
                .eq("user_id", Number(userId))
                .eq("is_active", true);

            if (error) throw error;

            const client = this.clients.get(userId);
            if (client && watchedWallets) {
                watchedWallets.forEach(({ wallet_address }) => {
                    client.watchedWallets.add(wallet_address);

                    const subscription: WalletSubscription = {
                        userId,
                        walletAddress: wallet_address,
                        monitorState: createWalletMonitor(),
                        lastActivity: new Date(),
                    };

                    this.walletSubscriptions.set(`${userId}:${wallet_address}`, subscription);
                    enableWatch(subscription.monitorState, [wallet_address]);
                });
            }
        } catch (error) {
            console.error(`❌ Error loading watched wallets for user ${userId}:`, error);
        }
    }

    private async saveWalletSubscription(userId: string, walletAddress: string): Promise<void> {
        const { error } = await supabase.from("wallet_subscriptions").insert({
            user_id: Number(userId),
            wallet_address: walletAddress,
            is_active: true,
            created_at: new Date().toISOString(),
        });

        if (error) throw error;
    }

    private async removeWalletSubscription(userId: string, walletAddress: string): Promise<void> {
        const { error } = await supabase
            .from("wallet_subscriptions")
            .update({ is_active: false })
            .eq("user_id", Number(userId))
            .eq("wallet_address", walletAddress);

        if (error) throw error;
    }

    public getActiveConnections(): number {
        return this.clients.size;
    }

    public getActiveSubscriptions(): number {
        return this.walletSubscriptions.size;
    }

    public getUserStats(userId: string): any {
        const client = this.clients.get(userId);
        if (!client) return null;

        return {
            userId,
            isConnected: client.ws.readyState === WebSocket.OPEN,
            watchedWallets: Array.from(client.watchedWallets),
            totalWatched: client.watchedWallets.size,
        };
    }

    public stop(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        this.clients.forEach((client) => {
            client.ws.close();
        });

        this.wss.close();
        console.log("🛑 WebSocket server stopped");
    }
}

export const walletSocketServer = new WalletSocketServer();
export { WalletSocketServer };

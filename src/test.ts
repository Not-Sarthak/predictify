import WebSocket from "ws";

interface WalletWatcherConfig {
    wallets: string[];
    apiKeys: {
        key: string;
        secret: string;
        passphrase: string;
    }[];
    onMessage?: (message: any) => void;
    onError?: (error: any) => void;
}

function watchWallets(config: WalletWatcherConfig): WebSocket[] {
    const { wallets, apiKeys, onMessage, onError } = config;
    const connections: WebSocket[] = [];

    wallets.forEach((wallet, index) => {
        const apiKey = apiKeys[index];
        if (!apiKey) {
            console.warn(`No API key provided for wallet ${wallet}`);
            return;
        }

        const ws = new WebSocket("wss://ws-subscriptions-clob.polymarket.com/ws/user");

        ws.on("open", () => {
            // Subscribe to user channel with authentication
            const subscribeMessage = {
                type: "USER",
                markets: [], // Empty array to watch all markets for this user
                auth: {
                    apiKey: apiKey.key,
                    secret: apiKey.secret,
                    passphrase: apiKey.passphrase,
                },
            };

            ws.send(JSON.stringify(subscribeMessage));

            // Send ping every 10 seconds to keep connection alive
            setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send("PING");
                }
            }, 10000);
        });

        ws.on("message", (data) => {
            try {
                const message = JSON.parse(data.toString());
                if (onMessage) {
                    onMessage({ wallet, message });
                }
            } catch (error) {
                console.error("Failed to parse message:", error);
            }
        });

        ws.on("error", (error) => {
            if (onError) {
                onError({ wallet, error });
            }
        });

        connections.push(ws);
    });

    return connections;
}

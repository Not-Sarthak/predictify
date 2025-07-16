import axios from "axios";

interface Trade {
    proxyWallet: string;
    side: "BUY" | "SELL";
    asset: string;
    conditionId: string;
    size: number;
    price: number;
    timestamp: number;
    title: string;
    outcome: string;
    transactionHash: string;
}

async function watchWalletTrades(walletAddress: string, pollInterval: number = 5000) {
    let lastTimestamp = Math.floor(Date.now() / 1000);

    try {
        const response = await axios.get("https://data-api.polymarket.com/trades", {
            params: {
                user: walletAddress,
                limit: 1,
                takerOnly: true,
            },
        });
        if (response.data && response.data.length > 0) {
            lastTimestamp = response.data[0].timestamp;
        }
    } catch (error) {
        console.error("Failed to get initial timestamp:", error);
    }

    console.log(`Watching trades for wallet: ${walletAddress}`);
    console.log(`Starting from timestamp: ${new Date(lastTimestamp * 1000).toISOString()}`);

    // Poll for new trades
    setInterval(async () => {
        try {
            const response = await axios.get("https://data-api.polymarket.com/trades", {
                params: {
                    user: walletAddress,
                    limit: 100,
                    takerOnly: true,
                },
            });

            const trades: Trade[] = response.data || [];
            const newTrades = trades.filter((trade) => trade.timestamp > lastTimestamp);

            if (newTrades.length > 0) {
                for (const trade of newTrades) {
                    console.log("New trade detected:", {
                        market: trade.title,
                        outcome: trade.outcome,
                        side: trade.side,
                        size: trade.size,
                        price: trade.price,
                        value: (trade.size * trade.price).toFixed(4),
                        hash: trade.transactionHash,
                        timestamp: new Date(trade.timestamp * 1000).toISOString(),
                    });
                }

                // Update last timestamp
                lastTimestamp = Math.max(...newTrades.map((t) => t.timestamp));
            }
        } catch (error) {
            console.error("Error fetching trades:", error);
        }
    }, pollInterval);
}

// Usage
const TARGET_WALLET = "0xc2BD182663434251d57EaaFAfF72F4480DE9A50e"; // Replace with actual wallet address
watchWalletTrades(TARGET_WALLET);

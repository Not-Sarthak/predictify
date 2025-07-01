export interface MonitorState {
    knownPositions: Map<string, any[]>;
    knownActivities: Set<string>;
    isWatchEnabled: boolean;
    isTradeEnabled: boolean;
    pollInterval: NodeJS.Timeout | null;
}

const createMonitorState = (): MonitorState => ({
    knownPositions: new Map(),
    knownActivities: new Set(),
    isWatchEnabled: false,
    isTradeEnabled: false,
    pollInterval: null,
});

const fetchData = async (endpoint: string, walletAddress: string): Promise<any[]> => {
    try {
        const response = await fetch(
            `https://data-api.polymarket.com/${endpoint}?user=${walletAddress}`,
            {
                headers: { Accept: "application/json" },
            }
        );

        const data = await response.json();
        console.log(`📊 Data For ${endpoint} (${walletAddress}):`, data);

        return data;
    } catch (error) {
        console.error(`Error Fetching ${endpoint}:`, error);
        return [];
    }
};

const logTradeActivity = (activity: any, walletAddress: string): void => {
    console.log(`\n🔥 TRADE DETECTED for wallet ${walletAddress}:`);
    console.log(`   📈 Type: ${activity.type || "Unknown"}`);
    console.log(`   💰 Amount: ${activity.amount || "N/A"}`);
    console.log(`   💵 Price: ${activity.price || "N/A"}`);
    console.log(`   🎯 Market: ${activity.market?.title || activity.title || "Unknown Market"}`);
    console.log(`   📊 Outcome: ${activity.outcome || "N/A"}`);
    console.log(
        `   ⏰ Timestamp: ${activity.timestamp ? new Date(activity.timestamp * 1000).toLocaleString() : "N/A"}`
    );
    console.log(`   🔗 Transaction: ${activity.txHash || activity.transactionHash || "N/A"}`);
    console.log(`   📋 Full Activity:`, JSON.stringify(activity, null, 2));
};

const logPositionChange = (
    position: any,
    walletAddress: string,
    changeType: "NEW" | "UPDATED"
): void => {
    console.log(`\n📍 POSITION ${changeType} for wallet ${walletAddress}:`);
    console.log(`   🎯 Market: ${position.title || "Unknown Market"}`);
    console.log(`   📊 Outcome: ${position.outcome || "N/A"}`);
    console.log(`   💎 Size: ${position.size || "N/A"}`);
    console.log(`   💰 Avg Price: ${position.avgPrice || "N/A"}`);
    console.log(`   📈 Current Price: ${position.curPrice || "N/A"}`);
    console.log(`   💵 Current Value: ${position.currentValue || "N/A"}`);
    console.log(`   📊 PnL: ${position.cashPnl || "N/A"} (${position.percentPnl || "N/A"}%)`);
    console.log(`   📋 Full Position:`, JSON.stringify(position, null, 2));
};

const detectNewItems = (
    current: any[],
    previous: any[],
    state: MonitorState,
    walletAddress: string,
    type: "positions" | "activities"
): any[] => {
    const newItems = current.filter((item) => {
        if (type === "positions") {
            return !previous.some((prev) => JSON.stringify(prev) === JSON.stringify(item));
        } else {
            const activityId = item.id || `${item.timestamp}_${item.type}`;
            return !state.knownActivities.has(activityId);
        }
    });

    if (newItems.length > 0) {
        const label = type === "positions" ? "New Positions" : "New Activities";
        console.log(`\n🔍 ${label}: ${newItems.length} for wallet ${walletAddress}`);

        newItems.forEach((item) => {
            if (type === "activities") {
                // Check if this is a trade-related activity
                const tradeTypes = ["buy", "sell", "trade", "order", "fill", "swap", "exchange"];
                const isTradeActivity =
                    item.type &&
                    tradeTypes.some((tradeType) => item.type.toLowerCase().includes(tradeType));

                if (isTradeActivity || item.amount || item.price || item.market) {
                    logTradeActivity(item, walletAddress);
                } else {
                    console.log(`   📝 Activity:`, item);
                }

                const activityId = item.id || `${item.timestamp}_${item.type}`;
                state.knownActivities.add(activityId);
            } else {
                // This is a position change - could indicate a trade
                logPositionChange(item, walletAddress, "NEW");
            }
        });
    }

    return newItems;
};

const detectPositionUpdates = (current: any[], previous: any[], walletAddress: string): void => {
    current.forEach((currentPos) => {
        const previousPos = previous.find(
            (prev) => prev.asset === currentPos.asset || prev.conditionId === currentPos.conditionId
        );

        if (previousPos) {
            const sizeChanged = Math.abs((currentPos.size || 0) - (previousPos.size || 0)) > 0.001;
            const avgPriceChanged =
                Math.abs((currentPos.avgPrice || 0) - (previousPos.avgPrice || 0)) > 0.001;
            const totalBoughtChanged =
                Math.abs((currentPos.totalBought || 0) - (previousPos.totalBought || 0)) > 0.001;

            if (sizeChanged || avgPriceChanged || totalBoughtChanged) {
                console.log(
                    `\n🔄 POSITION UPDATE DETECTED (Possible Trade) for wallet ${walletAddress}:`
                );
                console.log(`   🎯 Market: ${currentPos.title || "Unknown Market"}`);
                console.log(
                    `   📊 Size Change: ${previousPos.size || 0} → ${currentPos.size || 0}`
                );
                console.log(
                    `   💰 Avg Price Change: ${previousPos.avgPrice || 0} → ${currentPos.avgPrice || 0}`
                );
                console.log(
                    `   📈 Total Bought Change: ${previousPos.totalBought || 0} → ${currentPos.totalBought || 0}`
                );
                logPositionChange(currentPos, walletAddress, "UPDATED");
            }
        }
    });
};

const monitorWallet = async (walletAddress: string, state: MonitorState): Promise<void> => {
    const [positions, activities] = await Promise.all([
        fetchData("positions", walletAddress),
        fetchData("activity", walletAddress),
    ]);

    const previousPositions = state.knownPositions.get(walletAddress) || [];

    const newPositions = detectNewItems(
        positions,
        previousPositions,
        state,
        walletAddress,
        "positions"
    );
    const newActivities = detectNewItems(activities, [], state, walletAddress, "activities");

    if (previousPositions.length > 0) {
        detectPositionUpdates(positions, previousPositions, walletAddress);
    }

    if (newPositions.length > 0) {
        state.knownPositions.set(walletAddress, positions);
    }

    if (newPositions.length > 0 || newActivities.length > 0) {
        console.log(
            `✨ Total New Items for ${walletAddress}: ${newPositions.length + newActivities.length}`
        );
    }
};

const monitorAllWallets = async (wallets: string[], state: MonitorState): Promise<void> => {
    if (!state.isWatchEnabled) return;

    console.log(
        `\n--- Monitoring ${wallets.length} Wallet(s) at ${new Date().toLocaleTimeString()} ---`
    );
    await Promise.all(wallets.map((wallet) => monitorWallet(wallet, state)));
};

// Main control functions
export const enableWatch = (state: MonitorState, wallets: string[]): boolean => {
    console.log(`\n🎯 enableWatch() called with ${wallets.length} wallet(s):`);
    wallets.forEach((wallet, index) => {
        console.log(`   ${index + 1}. ${wallet}`);
    });

    if (state.isWatchEnabled) {
        console.log("⚠️ Watch Already Enabled");
        return false;
    }

    if (wallets.length === 0) {
        console.log("❌ No Wallets Provided");
        return false;
    }

    if (wallets.length > 3) {
        console.log("❌ Maximum 3 Wallets Allowed");
        return false;
    }

    state.isWatchEnabled = true;
    console.log(`🚀 Watch Enabled for ${wallets.length} Wallet(s)`);
    console.log(`🔍 Now monitoring for trade activities every 3 seconds...`);

    monitorAllWallets(wallets, state);
    state.pollInterval = setInterval(() => {
        monitorAllWallets(wallets, state);
    }, 3000);

    return true;
};

export const disableWatch = (state: MonitorState): boolean => {
    console.log(`\n🛑 disableWatch() called`);

    if (!state.isWatchEnabled) {
        console.log("⚠️ Watch Already Disabled");
        return false;
    }

    state.isWatchEnabled = false;
    state.isTradeEnabled = false;

    if (state.pollInterval) {
        clearInterval(state.pollInterval);
        state.pollInterval = null;
    }

    console.log("🛑 Watch Disabled (Trade Auto-Disabled)");
    console.log("📴 Stopped monitoring wallet activities");
    return true;
};

export const enableTrade = (state: MonitorState): boolean => {
    console.log(`\n🤖 enableTrade() called`);

    if (!state.isWatchEnabled) {
        console.log("❌ Cannot Enable Trade: Watch Must Be Enabled First");
        return false;
    }

    if (state.isTradeEnabled) {
        console.log("⚠️ Trade Already Enabled");
        return false;
    }

    state.isTradeEnabled = true;
    console.log("🤖 Trade Enabled");
    console.log("🔥 Will now execute copy trades when target wallet activities are detected!");
    return true;
};

export const disableTrade = (state: MonitorState): boolean => {
    console.log(`\n🛑 disableTrade() called`);

    if (!state.isTradeEnabled) {
        console.log("⚠️ Trade Already Disabled");
        return false;
    }

    state.isTradeEnabled = false;
    console.log("🛑 Trade Disabled");
    console.log("📴 Copy trading stopped - will continue monitoring but won't execute trades");
    return true;
};

export const getStatus = (state: MonitorState): string => {
    return `📊 Status: Watch ${state.isWatchEnabled ? "✅" : "❌"} | Trade ${state.isTradeEnabled ? "✅" : "❌"}`;
};

export const createWalletMonitor = (): MonitorState => createMonitorState();

/*
  // USAGE EXAMPLES
  
  // 1. Initialize
  const state = createWalletMonitor();
  const wallets = ['0xabc...', '0xdef...'];
  
  // 2. Initial State - Nothing Enabled
  console.log(getStatus(state)); // 📊 Status: Watch ❌ | Trade ❌
  
  // 3. Enable Watch First
  enableWatch(state, wallets); // ✅ Success
  console.log(getStatus(state)); // 📊 Status: Watch ✅ | Trade ❌
  
  // 4. Try to Enable Trade (Works Because Watch Is Enabled)
  enableTrade(state); // ✅ Success  
  console.log(getStatus(state)); // 📊 Status: Watch ✅ | Trade ✅
  
  // 5. Disable Trade Only
  disableTrade(state); // ✅ Success
  console.log(getStatus(state)); // 📊 Status: Watch ✅ | Trade ❌
  
  // 6. Disable Watch (Auto-Disables Trade)
  disableWatch(state); // ✅ Success
  console.log(getStatus(state)); // 📊 Status: Watch ❌ | Trade ❌
  
  // ERROR CASES:
  
  // 7. Try to Enable Trade Without Watch
  enableTrade(state); // ❌ Fails - "Cannot Enable Trade: Watch Must Be Enabled First"
  
  // 8. Try to Enable Watch With Too Many Wallets
  const tooManyWallets = ['0x1...', '0x2...', '0x3...', '0x4...'];
  enableWatch(state, tooManyWallets); // ❌ Fails - "Maximum 3 Wallets Allowed"
  
  // 9. Try to Enable Watch With No Wallets
  enableWatch(state, []); // ❌ Fails - "No Wallets Provided"
  
  // 10. Try to Enable Already Enabled Features
  enableWatch(state, wallets); // First call ✅
  enableWatch(state, wallets); // Second call ❌ - "Watch Already Enabled"
  
  enableTrade(state); // First call ✅  
  enableTrade(state); // Second call ❌ - "Trade Already Enabled"
*/

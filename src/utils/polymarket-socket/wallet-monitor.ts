interface MonitorState {
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

        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error(`Error Fetching ${endpoint}:`, error);
        return [];
    }
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
        newItems.forEach((item) => console.log(item));

        if (type === "activities") {
            newItems.forEach((item) => {
                const activityId = item.id || `${item.timestamp}_${item.type}`;
                state.knownActivities.add(activityId);
            });
        }
    }

    return newItems;
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

    monitorAllWallets(wallets, state);
    state.pollInterval = setInterval(() => {
        monitorAllWallets(wallets, state);
    }, 3000);

    return true;
};

export const disableWatch = (state: MonitorState): boolean => {
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
    return true;
};

export const enableTrade = (state: MonitorState): boolean => {
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
    return true;
};

export const disableTrade = (state: MonitorState): boolean => {
    if (!state.isTradeEnabled) {
        console.log("⚠️ Trade Already Disabled");
        return false;
    }

    state.isTradeEnabled = false;
    console.log("🛑 Trade Disabled");
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

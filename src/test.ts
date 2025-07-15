interface PolymarketPosition {
    id: string;
    market_id: string;
    asset_id: string;
    market?: {
        question: string;
        slug: string;
        end_date_iso: string;
        image?: string;
    };
    outcome: string;
    size: string;
    price: string;
    value: string;
    pnl: string;
    created_at: string;
    updated_at: string;
}

interface PolymarketUser {
    address: string;
    username?: string;
    name?: string;
    avatar_url?: string;
    total_volume: string;
    total_pnl: string;
    positions: PolymarketPosition[];
    markets_traded: number;
    last_trade_date?: string;
}

interface WatcherConfig {
    pollIntervalMs: number;
    enableDetailedLogs: boolean;
    maxRetries: number;
    retryDelayMs: number;
}

class PolymarketWatcher {
    private baseUrl = "https://strapi-matic.poly.market/api";
    private gammaUrl = "https://gamma-api.polymarket.com";
    private config: WatcherConfig;
    private isWatching = false;
    private intervalId?: NodeJS.Timeout;
    private retryCount = 0;
    private lastSuccessfulFetch?: Date;

    constructor(config: Partial<WatcherConfig> = {}) {
        this.config = {
            pollIntervalMs: 30000,
            enableDetailedLogs: true,
            maxRetries: 3,
            retryDelayMs: 5000,
            ...config,
        };

        this.log("INFO", "PolymarketWatcher initialized", {
            pollInterval: this.config.pollIntervalMs,
            maxRetries: this.config.maxRetries,
        });
    }

    private log(level: "INFO" | "WARN" | "ERROR" | "DEBUG", message: string, data?: any): void {
        if (!this.config.enableDetailedLogs && level === "DEBUG") return;

        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] ${message}`;

        if (data) {
            console.log(logEntry, data);
        } else {
            console.log(logEntry);
        }
    }

    /**
     * Fetch user profile from Polymarket API
     */
    private async fetchUserProfile(address: string): Promise<any> {
        this.log("DEBUG", `Fetching user profile for ${address}`);

        try {
            const response = await fetch(`${this.gammaUrl}/users/${address}`);

            this.log("DEBUG", `User profile API response status: ${response.status}`);

            if (!response.ok) {
                if (response.status === 404) {
                    this.log("WARN", `User not found: ${address}`);
                    return null;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const userData = await response.json();
            this.log("DEBUG", "User profile fetched successfully", {
                hasUsername: !!userData.username,
                hasAvatar: !!userData.avatar_url,
            });

            return userData;
        } catch (error: any) {
            this.log("ERROR", `Failed to fetch user profile for ${address}`, {
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Fetch user positions from Polymarket API
     */
    private async fetchUserPositions(address: string): Promise<PolymarketPosition[]> {
        this.log("DEBUG", `Fetching positions for ${address}`);

        try {
            const response = await fetch(`${this.gammaUrl}/users/${address}/positions`);

            this.log("DEBUG", `Positions API response status: ${response.status}`);

            if (!response.ok) {
                if (response.status === 404) {
                    this.log("WARN", `No positions found for user: ${address}`);
                    return [];
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const positionsData = await response.json();
            const positions = Array.isArray(positionsData)
                ? positionsData
                : positionsData.positions || [];

            this.log("INFO", `Fetched ${positions.length} positions for ${address}`);

            if (positions.length > 0) {
                this.log("DEBUG", "Sample position structure", positions[0]);
            }

            return positions;
        } catch (error: any) {
            this.log("ERROR", `Failed to fetch positions for ${address}`, { error: error.message });
            throw error;
        }
    }

    /**
     * Fetch additional market details for positions
     */
    private async enrichPositionsWithMarketData(
        positions: PolymarketPosition[]
    ): Promise<PolymarketPosition[]> {
        this.log("DEBUG", `Enriching ${positions.length} positions with market data`);

        const enrichedPositions: PolymarketPosition[] = [];

        for (const position of positions) {
            try {
                if (position.market_id) {
                    const marketResponse = await fetch(
                        `${this.gammaUrl}/markets/${position.market_id}`
                    );

                    if (marketResponse.ok) {
                        const marketData = await marketResponse.json();
                        enrichedPositions.push({
                            ...position,
                            market: {
                                question: marketData.question || "Unknown Market",
                                slug: marketData.slug || "",
                                end_date_iso: marketData.end_date_iso || "",
                                image: marketData.image,
                            },
                        });
                    } else {
                        this.log("WARN", `Failed to fetch market data for ${position.market_id}`);
                        enrichedPositions.push(position);
                    }
                } else {
                    enrichedPositions.push(position);
                }

                // Add small delay to avoid rate limiting
                await new Promise((resolve) => setTimeout(resolve, 100));
            } catch (error: any) {
                this.log("WARN", `Error enriching position ${position.id}`, {
                    error: error.message,
                });
                enrichedPositions.push(position);
            }
        }

        this.log("DEBUG", `Successfully enriched ${enrichedPositions.length} positions`);
        return enrichedPositions;
    }

    /**
     * Calculate user statistics from positions
     */
    private calculateUserStats(positions: PolymarketPosition[]): {
        totalVolume: string;
        totalPnl: string;
        marketsTraded: number;
        lastTradeDate?: string;
    } {
        let totalVolume = 0;
        let totalPnl = 0;
        const uniqueMarkets = new Set<string>();
        let lastTradeDate: string | undefined;

        for (const position of positions) {
            try {
                const volume = parseFloat(position.size) * parseFloat(position.price);
                const pnl = parseFloat(position.pnl || "0");

                totalVolume += volume;
                totalPnl += pnl;

                if (position.market_id) {
                    uniqueMarkets.add(position.market_id);
                }

                if (position.updated_at) {
                    if (!lastTradeDate || new Date(position.updated_at) > new Date(lastTradeDate)) {
                        lastTradeDate = position.updated_at;
                    }
                }
            } catch (error: any) {
                this.log("WARN", `Error calculating stats for position ${position.id}`, {
                    error: error.message,
                });
            }
        }

        return {
            totalVolume: totalVolume.toFixed(6),
            totalPnl: totalPnl.toFixed(6),
            marketsTraded: uniqueMarkets.size,
            lastTradeDate,
        };
    }

    /**
     * Fetch complete user data from Polymarket's API
     */
    async fetchUserData(address: string): Promise<PolymarketUser | null> {
        this.log("INFO", `Starting data fetch for user: ${address}`);

        try {
            // Validate address format
            if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
                throw new Error("Invalid Ethereum address format");
            }

            // Fetch user profile and positions concurrently
            const [userProfile, positions] = await Promise.all([
                this.fetchUserProfile(address),
                this.fetchUserPositions(address),
            ]);

            if (!userProfile && positions.length === 0) {
                this.log("WARN", `No data found for user: ${address}`);
                return null;
            }

            // Enrich positions with market data
            const enrichedPositions = await this.enrichPositionsWithMarketData(positions);

            // Calculate statistics
            const stats = this.calculateUserStats(enrichedPositions);

            const userData: PolymarketUser = {
                address,
                username: userProfile?.username,
                name: userProfile?.name,
                avatar_url: userProfile?.avatar_url,
                total_volume: stats.totalVolume,
                total_pnl: stats.totalPnl,
                positions: enrichedPositions,
                markets_traded: stats.marketsTraded,
                last_trade_date: stats.lastTradeDate,
            };

            this.log("INFO", `Successfully fetched user data for ${address}`, {
                username: userData.username,
                positionCount: userData.positions.length,
                totalVolume: userData.total_volume,
                totalPnl: userData.total_pnl,
                marketsTraded: userData.markets_traded,
            });

            this.lastSuccessfulFetch = new Date();
            this.retryCount = 0;

            return userData;
        } catch (error: any) {
            this.log("ERROR", `Failed to fetch user data for ${address}`, {
                error: error.message,
                retryCount: this.retryCount,
            });

            this.retryCount++;

            if (this.retryCount <= this.config.maxRetries) {
                this.log(
                    "INFO",
                    `Retrying in ${this.config.retryDelayMs}ms (${this.retryCount}/${this.config.maxRetries})`
                );
                await new Promise((resolve) => setTimeout(resolve, this.config.retryDelayMs));
                return this.fetchUserData(address);
            }

            return null;
        }
    }

    /**
     * Watch a user address for changes
     */
    async watchUser(
        address: string,
        onUpdate: (userData: PolymarketUser) => void,
        onError?: (error: Error) => void
    ): Promise<void> {
        if (this.isWatching) {
            throw new Error("Already watching a user. Stop current watcher first.");
        }

        this.log("INFO", `Starting to watch user: ${address}`, {
            pollInterval: this.config.pollIntervalMs,
        });

        this.isWatching = true;
        let lastDataHash = "";

        const checkForUpdates = async () => {
            try {
                this.log("DEBUG", `Checking for updates for ${address}`);

                const userData = await this.fetchUserData(address);
                if (!userData) {
                    const error = new Error(`Failed to fetch user data for ${address}`);
                    this.log("ERROR", "User data fetch failed", { address });
                    onError?.(error);
                    return;
                }

                // Create a hash of the current data to detect changes
                const currentDataHash = this.hashUserData(userData);

                this.log("DEBUG", `Data hash check`, {
                    currentHash: currentDataHash.substring(0, 10) + "...",
                    lastHash: lastDataHash.substring(0, 10) + "...",
                    hasChanged: currentDataHash !== lastDataHash,
                });

                if (currentDataHash !== lastDataHash) {
                    this.log("INFO", `Data changed for ${address}, triggering update callback`);
                    lastDataHash = currentDataHash;

                    // Log significant changes
                    this.logUserDataSummary(userData);

                    onUpdate(userData);
                } else {
                    this.log("DEBUG", `No changes detected for ${address}`);
                }
            } catch (error: any) {
                this.log("ERROR", `Error during update check for ${address}`, {
                    error: error.message,
                });
                onError?.(error as Error);
            }
        };

        // Initial fetch
        this.log("INFO", `Performing initial data fetch for ${address}`);
        await checkForUpdates();

        // Set up polling
        this.log("INFO", `Setting up polling every ${this.config.pollIntervalMs}ms`);
        this.intervalId = setInterval(checkForUpdates, this.config.pollIntervalMs);
    }

    /**
     * Stop watching the current user
     */
    stopWatching(): void {
        this.log("INFO", "Stopping user watcher");

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }

        this.isWatching = false;
        this.retryCount = 0;

        this.log("INFO", "User watcher stopped successfully");
    }

    /**
     * Check if currently watching
     */
    isCurrentlyWatching(): boolean {
        return this.isWatching;
    }

    /**
     * Get watcher status
     */
    getStatus(): {
        isWatching: boolean;
        lastSuccessfulFetch?: Date;
        retryCount: number;
        config: WatcherConfig;
    } {
        return {
            isWatching: this.isWatching,
            lastSuccessfulFetch: this.lastSuccessfulFetch,
            retryCount: this.retryCount,
            config: this.config,
        };
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<WatcherConfig>): void {
        const oldConfig = { ...this.config };
        this.config = { ...this.config, ...newConfig };

        this.log("INFO", "Configuration updated", {
            oldConfig,
            newConfig: this.config,
        });
    }

    /**
     * Helper to create a hash of user data for change detection
     */
    private hashUserData(userData: PolymarketUser): string {
        const hashableData = {
            total_volume: userData.total_volume,
            total_pnl: userData.total_pnl,
            markets_traded: userData.markets_traded,
            last_trade_date: userData.last_trade_date,
            positions: userData.positions.map((p) => ({
                id: p.id,
                size: p.size,
                price: p.price,
                value: p.value,
                pnl: p.pnl,
                updated_at: p.updated_at,
            })),
        };

        // Simple hash function
        const str = JSON.stringify(hashableData);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32-bit integer
        }

        return hash.toString();
    }

    /**
     * Log user data summary
     */
    private logUserDataSummary(userData: PolymarketUser): void {
        this.log("INFO", "User Data Summary", {
            address: userData.address,
            username: userData.username || "Anonymous",
            totalVolume: userData.total_volume,
            totalPnl: userData.total_pnl,
            marketsTraded: userData.markets_traded,
            activePositions: userData.positions.length,
            lastTradeDate: userData.last_trade_date,
        });

        // Log top 5 positions by value
        const topPositions = userData.positions
            .sort((a, b) => parseFloat(b.value) - parseFloat(a.value))
            .slice(0, 5);

        if (topPositions.length > 0) {
            this.log("INFO", "Top 5 Positions by Value");
            topPositions.forEach((position, index) => {
                this.log("INFO", `${index + 1}. ${position.market?.question || "Unknown Market"}`, {
                    outcome: position.outcome,
                    size: position.size,
                    value: position.value,
                    pnl: position.pnl,
                });
            });
        }
    }
}

// Usage example with detailed logging
async function example() {
    const watcher = new PolymarketWatcher({
        pollIntervalMs: 30000, // 30 seconds
        enableDetailedLogs: true,
        maxRetries: 3,
        retryDelayMs: 5000,
    });

    // Example address (replace with actual address)
    const userAddress = "0x1234567890abcdef1234567890abcdef12345678";

    try {
        await watcher.watchUser(
            userAddress,
            (userData) => {
                console.log("\n=== USER DATA UPDATE ===");
                console.log(`User: ${userData.username || userData.address}`);
                console.log(`Total Volume: $${userData.total_volume}`);
                console.log(`Total PnL: $${userData.total_pnl}`);
                console.log(`Markets Traded: ${userData.markets_traded}`);
                console.log(`Active Positions: ${userData.positions.length}`);

                if (userData.positions.length > 0) {
                    console.log("\nRecent Positions:");
                    userData.positions.slice(0, 3).forEach((position, index) => {
                        console.log(`${index + 1}. ${position.market?.question || "Loading..."}`);
                        console.log(`   Outcome: ${position.outcome}`);
                        console.log(`   Size: ${position.size} shares`);
                        console.log(`   Value: $${position.value}`);
                        console.log(`   PnL: $${position.pnl}`);
                    });
                }
                console.log("========================\n");
            },
            (error) => {
                console.error("❌ Watcher Error:", error.message);
            }
        );

        // Log watcher status periodically
        setInterval(() => {
            const status = watcher.getStatus();
            console.log("🔍 Watcher Status:", {
                isWatching: status.isWatching,
                lastFetch: status.lastSuccessfulFetch?.toISOString(),
                retryCount: status.retryCount,
            });
        }, 60000); // Every minute

        // Stop watching after 10 minutes
        setTimeout(() => {
            console.log("⏰ Stopping watcher after 10 minutes...");
            watcher.stopWatching();
        }, 600000);
    } catch (error) {
        console.error("Failed to start watching:", error);
    }
}

// Test function to verify API endpoints
async function testApiEndpoints(address: string) {
    const watcher = new PolymarketWatcher({ enableDetailedLogs: true });

    console.log("🧪 Testing API endpoints...");

    try {
        const userData = await watcher.fetchUserData(address);
        if (userData) {
            console.log("✅ API endpoints working correctly");
            console.log("📊 Sample data structure:", JSON.stringify(userData, null, 2));
        } else {
            console.log("❌ No data returned from API");
        }
    } catch (error) {
        console.error("❌ API test failed:", error);
    }
}

export {
    PolymarketWatcher,
    testApiEndpoints,
    type PolymarketUser,
    type PolymarketPosition,
    type WatcherConfig,
};

// Basic usage
const watcher = new PolymarketWatcher({
    pollIntervalMs: 30000,
    enableDetailedLogs: true,
    maxRetries: 3,
});

// Test the API first
await testApiEndpoints("0x1234567890abcdef1234567890abcdef12345678");

// Start watching
await watcher.watchUser(address, onUpdate, onError);

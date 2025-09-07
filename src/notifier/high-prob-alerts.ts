import { redisClient } from "../lib/redis";
import { bot } from "../bot";
import { getUserFilters } from "../bot/callbacks/high-probability";
import { fetchHighProbabilityMarkets } from "../utils/high-prob-trading/market-fetcher";
import type { HighProbMarket } from "../utils/high-prob-trading/market-filters";
import { t } from "../i18n";

interface UserAlertSettings {
    enabled: boolean;
    lastNotificationTime: number;
    notifiedMarkets: Set<string>; // Market IDs we've already notified about
}

const REDIS_KEY_PREFIX = "user:highprob_alerts:";
const REDIS_NOTIFIED_MARKETS_PREFIX = "user:highprob_notified:";
const COOLDOWN_PERIOD_MS = 30 * 60 * 1000; // 30 minutes between notifications
const MARKET_MEMORY_PERIOD_MS = 24 * 60 * 60 * 1000; // Remember markets for 24 hours

/**
 * Get user's alert settings
 */
export async function getUserAlertSettings(userId: string): Promise<UserAlertSettings> {
    try {
        const settings = await redisClient.hGetAll(`${REDIS_KEY_PREFIX}${userId}`);
        const notifiedMarketsStr = await redisClient.get(
            `${REDIS_NOTIFIED_MARKETS_PREFIX}${userId}`
        );

        return {
            enabled: settings.enabled === "true",
            lastNotificationTime: parseInt(settings.lastNotificationTime || "0"),
            notifiedMarkets: new Set(notifiedMarketsStr ? JSON.parse(notifiedMarketsStr) : []),
        };
    } catch (error) {
        console.error("Error getting user alert settings:", error);
        return {
            enabled: false,
            lastNotificationTime: 0,
            notifiedMarkets: new Set(),
        };
    }
}

/**
 * Update user's alert settings
 */
export async function setUserAlertSettings(
    userId: string,
    settings: Partial<UserAlertSettings>
): Promise<void> {
    try {
        const updates: Record<string, string> = {};

        if (settings.enabled !== undefined) {
            updates.enabled = settings.enabled.toString();
        }

        if (settings.lastNotificationTime !== undefined) {
            updates.lastNotificationTime = settings.lastNotificationTime.toString();
        }

        if (Object.keys(updates).length > 0) {
            await redisClient.hSet(`${REDIS_KEY_PREFIX}${userId}`, updates);
        }

        if (settings.notifiedMarkets !== undefined) {
            await redisClient.set(
                `${REDIS_NOTIFIED_MARKETS_PREFIX}${userId}`,
                JSON.stringify([...settings.notifiedMarkets]),
                { EX: MARKET_MEMORY_PERIOD_MS / 1000 } // Expire after 24 hours
            );
        }
    } catch (error) {
        console.error("Error setting user alert settings:", error);
    }
}

/**
 * Check if user is on cooldown for notifications
 */
function isOnCooldown(lastNotificationTime: number): boolean {
    return Date.now() - lastNotificationTime < COOLDOWN_PERIOD_MS;
}

/**
 * Generate alert message for new high-probability markets
 */
function generateAlertMessage(
    markets: HighProbMarket[],
    tradingMode: "normal" | "degen",
    timeFilter: string
): { text: string; reply_markup: any } {
    const modeText = tradingMode === "normal" ? "Normal (≥95%)" : "Degen (≥85%)";
    const count = markets.length;

    let message = `🚨 **High-Probability Market Alert** 🚨\n\n`;
    message += `Found **${count}** new market${count > 1 ? "s" : ""} matching your **${modeText}** criteria:\n\n`;

    const inlineKeyboard: any[] = [];

    markets.slice(0, 3).forEach((market, index) => {
        const probability = Math.round(market.probability * 100);
        const hoursLeft = Math.round(market.hoursUntilExpiry);
        const expectedReturn = market.expectedReturn.toFixed(1);

        message += `**${index + 1}.** ${market.question}\n`;
        message += `   • Probability: **${probability}%** (${market.bestOutcome.toUpperCase()})\n`;
        message += `   • Time Left: **${hoursLeft}h**\n`;
        message += `   • ${t("volume")}: **$${(market.volume || 0).toLocaleString()}**\n\n`;

        // Add buttons for this market - Trade and Go to Market
        inlineKeyboard.push([
            {
                text: `📊 Go to Market #${index + 1}`,
                callback_data: `market_details:${market.id}`,
            },
        ]);
    });

    if (count > 3) {
        message += `... and **${count - 3}** more market${count - 3 > 1 ? "s" : ""}!\n\n`;
    }

    message += `Use /highprob to view all markets and start trading! 📈`;

    return {
        text: message,
        reply_markup: {
            inline_keyboard: inlineKeyboard,
        },
    };
}

/**
 * Check for new high-probability markets and send alerts
 */
export async function checkAndSendAlerts(): Promise<void> {
    try {
        // Get all users with alert settings
        const userKeys = await redisClient.keys(`${REDIS_KEY_PREFIX}*`);

        for (const userKey of userKeys) {
            const userId = userKey.replace(REDIS_KEY_PREFIX, "");

            // Get user settings
            const alertSettings = await getUserAlertSettings(userId);

            if (!alertSettings.enabled) {
                continue; // Skip if alerts disabled
            }

            if (isOnCooldown(alertSettings.lastNotificationTime)) {
                continue; // Skip if on cooldown
            }

            // Get user's filter preferences
            const userFilters = await getUserFilters(parseInt(userId));

            // Determine which timeframes to check for this user.
            // First try per-user saved timeframes, fall back to the user's current timeFilter.
            let timeframes: Array<"1h" | "4h" | "24h" | "48h"> = [userFilters.timeFilter];
            try {
                const tfRaw = await redisClient.hGet(
                    `user:highprob_alert_timeframes:${userId}`,
                    "timeframes"
                );
                if (tfRaw) {
                    const parsed = JSON.parse(tfRaw);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        // Sanitize values to allowed set
                        const allowed = new Set(["1h", "4h", "24h", "48h"]);
                        timeframes = parsed.filter((t: any) => allowed.has(t));
                        if (timeframes.length === 0) timeframes = [userFilters.timeFilter];
                    }
                }
            } catch (e) {
                console.warn(
                    "Could not parse user timeframes, falling back to single timeframe",
                    e
                );
                timeframes = [userFilters.timeFilter];
            }

            // Fetch markets for each timeframe (in parallel) and combine unique results
            const fetchPromises = timeframes.map((tf) => {
                const filtersForTf = { ...userFilters, timeFilter: tf };
                return fetchHighProbabilityMarkets(filtersForTf);
            });
            const marketsByTf = await Promise.all(fetchPromises);
            const combinedMarkets = marketsByTf.flat();
            // Deduplicate by market id
            const marketsMap = new Map<string, (typeof combinedMarkets)[0]>();
            combinedMarkets.forEach((m) => {
                if (!marketsMap.has(m.id)) marketsMap.set(m.id, m);
            });
            const markets = Array.from(marketsMap.values());

            // Filter out markets we've already notified about
            const newMarkets = markets.filter(
                (market) => !alertSettings.notifiedMarkets.has(market.id)
            );

            if (newMarkets.length === 0) {
                continue; // No new markets
            }

            // Send alert
            try {
                const alertMessage = generateAlertMessage(
                    newMarkets,
                    userFilters.tradingMode,
                    userFilters.timeFilter
                );
                await bot.telegram.sendMessage(userId, alertMessage.text, {
                    parse_mode: "Markdown",
                    reply_markup: alertMessage.reply_markup,
                });

                // Update notification tracking
                const updatedNotifiedMarkets = new Set([
                    ...alertSettings.notifiedMarkets,
                    ...newMarkets.map((m) => m.id),
                ]);

                await setUserAlertSettings(userId, {
                    lastNotificationTime: Date.now(),
                    notifiedMarkets: updatedNotifiedMarkets,
                });

                console.log(
                    `✅ Sent high-prob alert to user ${userId} for ${newMarkets.length} markets`
                );
            } catch (error) {
                console.error(`Error sending alert to user ${userId}:`, error);
            }
        }
    } catch (error) {
        console.error("Error in checkAndSendAlerts:", error);
    }
}

/**
 * Start the alert monitoring system
 */
export function startHighProbAlerts(): void {
    console.log("🔔 Starting High-Probability Market Alerts system...");

    // Check for alerts every 10 minutes
    setInterval(checkAndSendAlerts, 10 * 60 * 1000);

    // Initial check after 30 seconds
    setTimeout(checkAndSendAlerts, 30 * 1000);
}

/**
 * Enable alerts for a user
 */
export async function enableAlertsForUser(userId: string): Promise<void> {
    await setUserAlertSettings(userId, {
        enabled: true,
        lastNotificationTime: 0, // Reset cooldown
        notifiedMarkets: new Set(), // Reset notifications
    });
}

/**
 * Enable alerts and set default strategy timeframes
 */
export async function enableAlertsForUserWithTimeframes(
    userId: string,
    timeframes: Array<"1h" | "4h" | "24h" | "48h"> = ["1h", "4h", "24h", "48h"]
): Promise<void> {
    await setUserAlertSettings(userId, {
        enabled: true,
        lastNotificationTime: 0,
        notifiedMarkets: new Set(),
    });

    // Save preferred timeframes for high-prob alerts per user
    try {
        await redisClient.hSet(`user:highprob_alert_timeframes:${userId}`, {
            timeframes: JSON.stringify(timeframes),
        });
    } catch (error) {
        console.error("Error saving user alert timeframes:", error);
    }
}

/**
 * Disable alerts for a user
 */
export async function disableAlertsForUser(userId: string): Promise<void> {
    await setUserAlertSettings(userId, {
        enabled: false,
    });
}

/**
 * Get alert status for display
 */
export async function getAlertStatusMessage(userId: string): Promise<string> {
    const settings = await getUserAlertSettings(userId);

    if (!settings.enabled) {
        return "🔕 **Market Alerts:** Disabled";
    }

    const timeSinceLastNotification = Date.now() - settings.lastNotificationTime;
    const cooldownRemaining = Math.max(0, COOLDOWN_PERIOD_MS - timeSinceLastNotification);

    if (cooldownRemaining > 0) {
        const minutesRemaining = Math.ceil(cooldownRemaining / (60 * 1000));
        return `🔔 **Market Alerts:** Enabled (Next check in ${minutesRemaining}m)`;
    }

    return "🔔 **Market Alerts:** Enabled (Ready to notify)";
}

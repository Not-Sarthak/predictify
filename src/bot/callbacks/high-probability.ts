import { Markup, type Context } from "telegraf";
import { formatDollarVolume, formatOrderBook, getUserIdFromCtx } from "../utils";
import { setUserInputState } from "../input/state";
import { redisClient } from "../../lib/redis";
import {
    fetchHighProbabilityMarkets,
    executeBatchTrades,
    defaultFilters,
    type HighProbFilters,
    type HighProbMarket,
} from "../../utils/high-prob-trading";
import {
    handleHighProbabilityCommand,
    handleViewHighProbMarkets,
    handleHighProbHelp,
    handleStrategySelection,
} from "../commands/high-probability";
import {
    getAlertStatusMessage,
    enableAlertsForUser,
    disableAlertsForUser,
    getUserAlertSettings,
} from "../../notifier/high-prob-alerts";

import { escapeMarkdown } from "../utils";
import { getUserLanguage } from "../../helpers/user-language";
import { t } from "../../i18n";
import { db } from "../../lib/supabase";
import { encodeMarketConditionId } from "../../utils/encoding";

// Helper function to get user's custom filters or defaults
export async function getUserFilters(userId: number): Promise<HighProbFilters> {
    try {
        const userFilters = await redisClient.hGetAll(`user:highprob_filters:${userId}`);

        if (Object.keys(userFilters).length === 0) {
            return defaultFilters;
        }

        return {
            timeFilter: (userFilters.timeFilter as "24h" | "48h") || defaultFilters.timeFilter,
            tradingMode:
                (userFilters.tradingMode as "normal" | "degen") || defaultFilters.tradingMode,
            excludeCrypto: userFilters.excludeCrypto === "true", // Now properly read from Redis
        };
    } catch (error) {
        console.error("Error getting user filters:", error);
        return defaultFilters;
    }
}

export async function handleHighProbCallback(ctx: Context, action: string, params?: string[]) {
    try {
        switch (action) {
            case "menu":
                return handleHighProbabilityCommand(ctx);

            case "strategy":
                const strategy = params?.[0] as "degen" | "turtle";
                const timeFilter = (params?.[1] as "24h" | "48h") || "24h";
                return handleStrategySelection(ctx, strategy, timeFilter);

            case "market":
                const marketId = params?.[0];
                const marketStrategy = params?.[1] as "degen" | "turtle";
                const marketTimeFilter = params?.[2] as "24h" | "48h";
                return handleViewHighProbMarket(ctx, marketId!, marketStrategy, marketTimeFilter);

            case "toggle_crypto":
                const toggleStrategy = params?.[0] as "degen" | "turtle";
                const toggleTimeFilter = (params?.[1] as "24h" | "48h") || "24h";
                return handleToggleCrypto(ctx, toggleStrategy, toggleTimeFilter);

            case "strategy_alerts":
                const alertStrategy = params?.[0] as "degen" | "turtle";
                const alertTimeFilter = (params?.[1] as "24h" | "48h") || "24h";
                return handleStrategyAlertsToggle(ctx, alertStrategy, alertTimeFilter);

            case "autosplit":
                const autoStrategy = params?.[0] as "degen" | "turtle";
                const autoTimeFilter = (params?.[1] as "24h" | "48h") || "24h";
                return handleAutoSplitSetup(ctx, autoTimeFilter, autoStrategy);

            case "view":
                const oldTimeFilter = (params?.[0] as "24h" | "48h") || "24h";
                const offset = parseInt(params?.[1] || "0");
                return handleViewHighProbMarkets(ctx, oldTimeFilter, offset);

            case "execute":
                const executeMode = params?.[0] as "autosplit" | "manual";
                return handleExecuteTrade(ctx, executeMode);

            case "filters":
                return handleFiltersMenu(ctx);

            case "filter":
                const filterType = params?.[0]; // volume, prob, crypto, time
                const filterValue = params?.[1];
                return handleFilterChange(ctx, filterType!, filterValue!);

            case "help":
                return handleHighProbHelp(ctx);

            default:
                return handleHighProbabilityCommand(ctx);
        }
    } catch (error) {
        console.error("Error in high prob callback:", error);
        return ctx.reply("❌ An error occurred. Please try again.");
    }
}

export async function handleViewHighProbMarket(
    ctx: Context,
    marketId: string,
    strategy: "degen" | "turtle",
    timeFilter: "24h" | "48h"
) {
    try {
        // Always fetch from high-probability markets to ensure we have complete volume data
        const userId = getUserIdFromCtx(ctx);
        const userFilters = await getUserFilters(userId);
        const filters: HighProbFilters = {
            ...userFilters,
            timeFilter,
            tradingMode: strategy === "degen" ? "normal" : ("degen" as "normal" | "degen"),
        };

        const markets = await fetchHighProbabilityMarkets(filters, 50);

        // Find the market in our high-prob results
        const market = markets.find((m) => m.id === marketId);

        if (!market) {
            return ctx.reply("❌ Market not found. It may have been removed or changed.");
        }

        const language = await getUserLanguage(userId);

        // Format the market message manually to avoid compatibility issues
        const outcomes = market.outcomePrices ? JSON.parse(market.outcomePrices) : [0, 0];
        const yesPrice = outcomes[0] || 0;
        const noPrice = outcomes[1] || 0;

        // Try multiple volume sources - prioritize 24hr, then others, then liquidity as fallback
        const volume =
            market.volume24hr || market.volume1wk || market.volume || market.liquidity || 0;
        const liquidityNum = market.liquidity || 0;

        let message = `📊 **${escapeMarkdown(market.question || market.title || "Market")}**\n\n`;
        message += `� **Volume**: ${formatDollarVolume(volume)}\n`;
        message += `� **Liquidity**: ${formatDollarVolume(liquidityNum)}\n`;
        message += `📊 **Status**: ${market.closed ? "Closed" : "Active"}\n\n`;

        // Add prominent price display right before order book for better visibility
        const yesPercentage = (yesPrice * 100).toFixed(1);
        const noPercentage = (noPrice * 100).toFixed(1);

        message += `📈 **${t("price", language)}**\n`;
        message += `• **${t("yes", language)}: ${yesPercentage}%**\n`;
        message += `• **${t("no", language)}: ${noPercentage}%**\n\n`;

        // Add order book if possible
        if (userId && market.clobTokenIds) {
            const tokenIds = JSON.parse(market.clobTokenIds);
            const orderBookData = await formatOrderBook(tokenIds, userId.toString());
            message += orderBookData;
            message += `----------------------------------\n\n`;
        }

        let watchlistButton;
        if (userId) {
            const { data: user } = await db("Users")
                .select("market_watchlist")
                .eq("id", userId)
                .single();

            const isInWatchlist =
                (Array.isArray(user?.market_watchlist) &&
                    user.market_watchlist.some(
                        (item: any) => item.marketId === marketId || item.marketId === market.id
                    )) ||
                false;

            watchlistButton = isInWatchlist
                ? Markup.button.callback(
                      "💔 Remove from Watchlist",
                      `remove_watchlist:${market.id}`
                  )
                : Markup.button.callback(
                      t("addToWatchlist", language),
                      `add_watchlist:${market.id}`
                  );
        } else {
            watchlistButton = Markup.button.callback(
                t("addToWatchlist", language),
                `add_watchlist:${market.id}`
            );
        }

        const keyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback(t("marketYes", language), `market_order:${market.id}:yes`),
                Markup.button.callback(t("marketNo", language), `market_order:${market.id}:no`),
            ],
            [
                Markup.button.callback(t("limitYes", language), `limit_order:${market.id}:yes`),
                Markup.button.callback(t("limitNo", language), `limit_order:${market.id}:no`),
            ],
            [
                Markup.button.callback(
                    t("setPriceAlert", language),
                    `set_price_alert:${encodeMarketConditionId(market.id)}`
                ),
            ],
            [watchlistButton],
            [Markup.button.callback(t("aboutThisMarket", language), `market_details:${market.id}`)],
            [
                Markup.button.callback(
                    t("refresh", language),
                    `highprob:market:${market.id}:${strategy}:${timeFilter}`
                ),
                Markup.button.callback(
                    t("back", language),
                    `highprob:strategy:${strategy}:${timeFilter}`
                ),
            ],
        ]);

        return ctx.reply(message, {
            parse_mode: "Markdown",
            reply_markup: keyboard.reply_markup,
        });
    } catch (error) {
        console.error("Error viewing high-prob market:", error);
        return ctx.reply("❌ Error loading market details. Please try again.", {
            reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback("🔙 Back", `highprob:strategy:${strategy}:${timeFilter}`)],
            ]).reply_markup,
        });
    }
}

export async function handleToggleCrypto(
    ctx: Context,
    strategy: "degen" | "turtle",
    timeFilter: "24h" | "48h"
) {
    const userId = getUserIdFromCtx(ctx);

    try {
        // Get current filters
        const userFilters = await getUserFilters(userId);

        // Toggle crypto setting
        const newExcludeCrypto = !userFilters.excludeCrypto;

        // Save the updated filter
        await redisClient.hSet(`user:highprob_filters:${userId}`, {
            excludeCrypto: newExcludeCrypto.toString(),
        });

        // Refresh the markets view with new filter
        return handleStrategySelection(ctx, strategy, timeFilter);
    } catch (error) {
        console.error("Error toggling crypto filter:", error);
        return ctx.reply("❌ Error updating filter. Please try again.");
    }
}

export async function handleStrategyAlertsToggle(
    ctx: Context,
    strategy: "degen" | "turtle",
    timeFilter: "24h" | "48h"
) {
    const userId = getUserIdFromCtx(ctx);

    try {
        // Toggle alerts
        const alertSettings = await getUserAlertSettings(userId.toString());
        if (alertSettings.enabled) {
            await disableAlertsForUser(userId.toString());
            await ctx.answerCbQuery("🔕 Alerts disabled");
        } else {
            await enableAlertsForUser(userId.toString());
            await ctx.answerCbQuery("🔔 Alerts enabled!");
        }

        // Refresh the strategy view
        return handleStrategySelection(ctx, strategy, timeFilter);
    } catch (error) {
        console.error("Error toggling alerts:", error);
        return ctx.answerCbQuery("❌ Error updating alerts");
    }
}

export async function handleAutoSplitSetup(
    ctx: Context,
    timeFilter: "24h" | "48h",
    strategy?: "degen" | "turtle"
) {
    const msg = await ctx.reply("🔍 Loading qualifying markets...");

    try {
        const userId = getUserIdFromCtx(ctx);
        const userFilters = await getUserFilters(userId);

        const filters: HighProbFilters = {
            ...userFilters,
            timeFilter,
        };

        const markets = await fetchHighProbabilityMarkets(filters, 50);

        await ctx.deleteMessage(msg.message_id);

        if (markets.length === 0) {
            const language = await getUserLanguage(userId);
            return ctx.reply(
                `📊 **${t("noMarketsFound", language)}**\n\n` +
                    `No markets found for auto-split trading with current filters.\n\n` +
                    `Try adjusting filters or check back later.`,
                {
                    parse_mode: "Markdown",
                    reply_markup: Markup.inlineKeyboard([
                        [Markup.button.callback(t("adjustFilters", language), "highprob:filters")],
                        [Markup.button.callback(t("backToMenu", language), "highprob:menu")],
                    ]).reply_markup,
                }
            );
        }

        const topMarkets = markets.slice(0, 10);
        const avgReturn = (
            topMarkets.reduce((sum, m) => sum + m.expectedReturn, 0) / topMarkets.length
        ).toFixed(1);

        let message = `🎯 **Auto-Split Trade Setup**\n\n`;
        message += `Found **${markets.length}** qualifying markets (${timeFilter})\n`;
        message += `Will distribute equally across top **${Math.min(10, markets.length)}** markets\n\n`;

        message += `**Top Markets Preview:**\n`;
        topMarkets.slice(0, 3).forEach((market, index) => {
            const probability = Math.round(market.probability * 100);
            message += `${index + 1}. ${escapeMarkdown(market.question.substring(0, 50))}...\n`;
            message += `   🎯 ${market.bestOutcome.toUpperCase()} @ ${probability}% • +${market.expectedReturn.toFixed(1)}%\n\n`;
        });

        if (topMarkets.length > 3) {
            message += `...and ${topMarkets.length - 3} more markets\n\n`;
        }

        message += `**Strategy Summary:**\n`;
        message += `• **Markets:** ${Math.min(10, markets.length)}\n`;
        message += `• **Time Frame:** ${timeFilter}\n\n`;
        message += `💡 Enter the total amount to invest (e.g., \`100\`)`;

        // Store context for input handling
        await redisClient.hSet(`user:highprob_context:${userId}`, {
            mode: "autosplit",
            timeFilter,
            marketCount: Math.min(10, markets.length),
        });

        setUserInputState(userId.toString(), "highprob_autosplit_amount");

        return ctx.reply(message, {
            parse_mode: "Markdown",
            reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback("🔙 Back to Markets", `highprob:view:${timeFilter}`)],
                [Markup.button.callback("❌ Cancel", "highprob:menu")],
            ]).reply_markup,
        });
    } catch (error) {
        await ctx.deleteMessage(msg.message_id);
        console.error("Error setting up auto-split:", error);
        return ctx.reply("❌ Error loading markets. Please try again later.");
    }
}

export async function handleManualSelectionSetup(ctx: Context, timeFilter: "24h" | "48h") {
    const msg = await ctx.reply("🔍 Loading markets for manual selection...");

    try {
        const userId = getUserIdFromCtx(ctx);
        const userFilters = await getUserFilters(userId);

        const filters: HighProbFilters = {
            ...userFilters,
            timeFilter,
        };

        const markets = await fetchHighProbabilityMarkets(filters, 50);

        await ctx.deleteMessage(msg.message_id);

        if (markets.length === 0) {
            const language = await getUserLanguage(userId);
            return ctx.reply(
                `📊 **${t("noMarketsFound", language)}**\n\n` +
                    `No markets found for manual selection with current filters.\n\n` +
                    `Try adjusting filters or check back later.`,
                {
                    parse_mode: "Markdown",
                    reply_markup: Markup.inlineKeyboard([
                        [Markup.button.callback(t("adjustFilters", language), "highprob:filters")],
                        [Markup.button.callback(t("backToMenu", language), "highprob:menu")],
                    ]).reply_markup,
                }
            );
        }

        return sendManualSelectionMarkets(ctx, markets, timeFilter, 0, []);
    } catch (error) {
        await ctx.deleteMessage(msg.message_id);
        console.error("Error setting up manual selection:", error);
        return ctx.reply("❌ Error loading markets. Please try again later.");
    }
}

async function sendManualSelectionMarkets(
    ctx: Context,
    markets: HighProbMarket[],
    timeFilter: "24h" | "48h",
    offset: number,
    selectedMarkets: string[]
) {
    const language = await getUserLanguage(getUserIdFromCtx(ctx));
    const LIMIT = 5;
    const start = offset;
    const end = offset + LIMIT;
    const currentMarkets = markets.slice(start, end);

    let message = `✋ **Manual Market Selection (${timeFilter})**\n`;
    message += `📊 ${markets.length} markets available • ${selectedMarkets.length} selected\n\n`;

    currentMarkets.forEach((market, index) => {
        const marketNum = start + index + 1;
        const probability = Math.round(market.probability * 100);
        const expectedReturn = market.expectedReturn.toFixed(1);
        // const volume = formatDollarVolume(market.volume || 0);
        const hoursLeft = Math.round(market.hoursUntilExpiry);
        const isSelected = selectedMarkets.includes(market.id);
        const indicator = isSelected ? "✅" : "⭕";

        message += `${indicator} **${marketNum}.** ${escapeMarkdown(market.question.substring(0, 60))}${market.question.length > 60 ? "..." : ""}\n`;
        message += `🎯 **${market.bestOutcome.toUpperCase()}** @ ${probability}% • ⏰ ${hoursLeft}h • 📈 +${expectedReturn}%\n\n`;
    });

    if (selectedMarkets.length > 0) {
        message += `\n🎯 **${selectedMarkets.length} markets selected**\n`;
        message += `Ready to proceed with manual trading.`;
    }

    // Market selection buttons
    const selectionButtons = currentMarkets.map((market, index) => {
        const marketNum = start + index + 1;
        const isSelected = selectedMarkets.includes(market.id);
        const action = isSelected ? "deselect" : "select";
        return Markup.button.callback(
            `${isSelected ? "✅" : "⭕"} ${marketNum}`,
            `highprob:manual_${action}:${market.id}:${timeFilter}:${offset}`
        );
    });

    // Layout selection buttons in rows of 3
    const selectionRows = [];
    for (let i = 0; i < selectionButtons.length; i += 3) {
        selectionRows.push(selectionButtons.slice(i, i + 3));
    }

    // Navigation buttons
    const navButtons = [];
    if (offset > 0) {
        navButtons.push(
            Markup.button.callback(
                t("previous", language),
                `highprob:manual_nav:${timeFilter}:${offset - LIMIT}`
            )
        );
    }
    if (end < markets.length) {
        navButtons.push(
            Markup.button.callback(
                t("next", language),
                `highprob:manual_nav:${timeFilter}:${offset + LIMIT}`
            )
        );
    }

    // Action buttons
    const actionButtons = [];
    if (selectedMarkets.length > 0) {
        actionButtons.push(
            Markup.button.callback(
                t("tradeSelected", language),
                `highprob:manual_trade:${timeFilter}`
            )
        );
    }
    actionButtons.push(
        Markup.button.callback(
            t("clearAll", language),
            `highprob:manual_clear:${timeFilter}:${offset}`
        )
    );

    const keyboard = Markup.inlineKeyboard([
        ...selectionRows,
        navButtons,
        actionButtons,
        [Markup.button.callback(t("backToMenu", language), "highprob:menu")],
    ]);

    // Store selection state
    const userId = getUserIdFromCtx(ctx);
    await redisClient.hSet(`user:highprob_context:${userId}`, {
        mode: "manual",
        timeFilter,
        selectedMarkets: JSON.stringify(selectedMarkets),
    });

    const isPagination =
        ctx.callbackQuery && (ctx.callbackQuery as any)?.data?.includes("manual_nav");

    if (isPagination) {
        try {
            await ctx.editMessageText(message, {
                parse_mode: "Markdown",
                reply_markup: keyboard.reply_markup,
            });
        } catch (error: any) {
            if (
                error?.response?.error_code === 400 &&
                error?.response?.description?.includes("message is not modified")
            ) {
                await ctx.answerCbQuery();
            } else {
                console.error("❌ editMessageText Failed:", error);
                await ctx.answerCbQuery("⚠️ Failed to update the message.");
            }
        }
    } else {
        return ctx.reply(message, {
            parse_mode: "Markdown",
            reply_markup: keyboard.reply_markup,
        });
    }
}

export async function handleFiltersMenu(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);
    const userFilters = await getUserFilters(userId);

    const minProb = userFilters.tradingMode === "normal" ? 60 : 80;
    const maxProb = userFilters.tradingMode === "normal" ? 90 : 95;
    const probabilityRange = `${minProb}-${maxProb}%`;
    const riskLevel = userFilters.tradingMode === "normal" ? "Conservative" : "Aggressive";

    // Create ticks for selected options
    const timeFilterTick24h = userFilters.timeFilter === "24h" ? "✅" : "⏰";
    const timeFilterTick48h = userFilters.timeFilter === "48h" ? "✅" : "⏰";

    const modeTickNormal = userFilters.tradingMode === "normal" ? "✅" : "🎯";
    const modeTickDegen = userFilters.tradingMode === "degen" ? "✅" : "⚡";

    // Crypto filter status
    const cryptoStatus = userFilters.excludeCrypto ? "Excluded" : "Included";
    const cryptoIcon = userFilters.excludeCrypto ? "🚫" : "✅";

    // Get alert status
    const alertStatus = await getAlertStatusMessage(userId.toString());

    const message = `
⚙️ **High-Probability Market Filters**

**Current Settings:**
• **Time Filter:** ${userFilters.timeFilter}
• **Trading Mode:** ${userFilters.tradingMode === "normal" ? "Conservative" : "Aggressive"}
• **Probability:** ${probabilityRange}
• **Risk Level:** ${riskLevel}
• **Crypto Markets:** ${cryptoStatus}
• **Sports Markets:** Excluded (permanently)
• **0DTE Markets:** Excluded (< 1 hour)
• **Resolved Markets:** Excluded (100% probability)
• **Long-term Markets:** Excluded (> 7 days or no end date)
• **Invalid Dates:** Excluded (missing/invalid end dates)
${alertStatus}

**Filter Options:**
    `;

    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback(`${timeFilterTick24h} Time: 24h`, "highprob:filter:time:24h"),
            Markup.button.callback(`${timeFilterTick48h} Time: 48h`, "highprob:filter:time:48h"),
        ],
        [
            Markup.button.callback(
                `${modeTickNormal} Conservative Mode`,
                "highprob:filter:mode:normal"
            ),
            Markup.button.callback(
                `${modeTickDegen} Aggressive Mode`,
                "highprob:filter:mode:degen"
            ),
        ],
        [
            Markup.button.callback(
                `${cryptoIcon} Crypto: ${cryptoStatus}`,
                "highprob:filter:crypto:toggle"
            ),
        ],
        [Markup.button.callback("🔔 Toggle Alerts", "highprob:filter:alerts:toggle")],
        [
            Markup.button.callback("🔄 Test Filters", `highprob:view:${userFilters.timeFilter}`),
            Markup.button.callback("🔙 Back to Menu", "highprob:menu"),
        ],
    ]);

    return ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: keyboard.reply_markup,
    });
}

export async function handleFilterChange(ctx: Context, filterType: string, filterValue: string) {
    const userId = getUserIdFromCtx(ctx);

    try {
        // Get or create user's custom filters
        let userFilters = await redisClient.hGetAll(`user:highprob_filters:${userId}`);

        // Initialize with defaults if empty
        if (Object.keys(userFilters).length === 0) {
            userFilters = {
                timeFilter: defaultFilters.timeFilter,
                tradingMode: defaultFilters.tradingMode,
                excludeCrypto: defaultFilters.excludeCrypto.toString(),
            };
        }

        // Update the specific filter
        switch (filterType) {
            case "time":
                userFilters.timeFilter = filterValue as "24h" | "48h";
                break;
            case "mode":
                userFilters.tradingMode = filterValue as "normal" | "degen";
                break;
            case "crypto":
                if (filterValue === "toggle") {
                    const currentExcludeCrypto = userFilters.excludeCrypto === "true";
                    userFilters.excludeCrypto = (!currentExcludeCrypto).toString();
                    const status = currentExcludeCrypto ? "included" : "excluded";
                    await ctx.answerCbQuery(`🪙 Crypto markets now ${status}`);
                }
                break;
            case "alerts":
                if (filterValue === "toggle") {
                    // Toggle alerts
                    const alertSettings = await getUserAlertSettings(userId.toString());
                    if (alertSettings.enabled) {
                        await disableAlertsForUser(userId.toString());
                        await ctx.answerCbQuery("🔕 Alerts disabled");
                    } else {
                        await enableAlertsForUser(userId.toString());
                        await ctx.answerCbQuery("🔔 Alerts enabled!");
                    }

                    // Check if we need to redirect back to strategy view
                    const callbackData = (ctx.callbackQuery as any)?.data;
                    if (callbackData && callbackData.includes("strategy")) {
                        // Extract strategy and timeFilter from previous context if available
                        try {
                            const context = await redisClient.hGetAll(
                                `user:highprob_context:${userId}`
                            );
                            if (context.mode && context.timeFilter) {
                                const strategy = context.mode === "normal" ? "turtle" : "degen";
                                const timeFilter = context.timeFilter as "24h" | "48h";
                                return handleStrategySelection(ctx, strategy, timeFilter);
                            }
                        } catch (e) {
                            // Fall back to filters menu
                        }
                    }

                    return handleFiltersMenu(ctx); // Refresh the menu
                }
                break;
        }

        // Save updated filters
        await redisClient.hSet(`user:highprob_filters:${userId}`, userFilters);

        // Show updated filters menu
        return showUpdatedFiltersMenu(ctx, userFilters);
    } catch (error) {
        console.error("Error changing filter:", error);
        return ctx.answerCbQuery("❌ Error updating filter");
    }
}

async function showUpdatedFiltersMenu(ctx: Context, userFilters: any) {
    const minProb = userFilters.tradingMode === "normal" ? 60 : 80;
    const maxProb = userFilters.tradingMode === "normal" ? 90 : 95;
    const probabilityRange = `${minProb}-${maxProb}%`;
    const riskLevel = userFilters.tradingMode === "normal" ? "Conservative" : "Aggressive";

    // Create ticks for selected options
    const timeFilterTick24h = userFilters.timeFilter === "24h" ? "✅" : "⏰";
    const timeFilterTick48h = userFilters.timeFilter === "48h" ? "✅" : "⏰";

    const modeTickNormal = userFilters.tradingMode === "normal" ? "✅" : "🎯";
    const modeTickDegen = userFilters.tradingMode === "degen" ? "✅" : "⚡";

    // Crypto filter status
    const cryptoExcluded = userFilters.excludeCrypto === "true";
    const cryptoStatus = cryptoExcluded ? "Excluded" : "Included";
    const cryptoIcon = cryptoExcluded ? "🚫" : "✅";

    // Get alert status
    const userId = getUserIdFromCtx(ctx);
    const alertStatus = await getAlertStatusMessage(userId.toString());

    const message = `
⚙️ **High-Probability Market Filters** ✅ Updated!

**Current Settings:**
• **Time Filter:** ${userFilters.timeFilter}
• **Trading Mode:** ${userFilters.tradingMode === "normal" ? "Conservative" : "Aggressive"}
• **Probability:** ${probabilityRange}
• **Risk Level:** ${riskLevel}
• **Crypto Markets:** ${cryptoStatus}
• **Sports Markets:** Excluded (permanently)
• **0DTE Markets:** Excluded (< 1 hour)
• **Resolved Markets:** Excluded (100% probability)
• **Long-term Markets:** Excluded (> 7 days or no end date)
• **Invalid Dates:** Excluded (missing/invalid end dates)
${alertStatus}

**Filter Options:**
    `;

    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback(`${timeFilterTick24h} Time: 24h`, "highprob:filter:time:24h"),
            Markup.button.callback(`${timeFilterTick48h} Time: 48h`, "highprob:filter:time:48h"),
        ],
        [
            Markup.button.callback(
                `${modeTickNormal} Conservative Mode`,
                "highprob:filter:mode:normal"
            ),
            Markup.button.callback(
                `${modeTickDegen} Aggressive Mode`,
                "highprob:filter:mode:degen"
            ),
        ],
        [
            Markup.button.callback(
                `${cryptoIcon} Crypto: ${cryptoStatus}`,
                "highprob:filter:crypto:toggle"
            ),
        ],
        [Markup.button.callback("🔔 Toggle Alerts", "highprob:filter:alerts:toggle")],
        [
            Markup.button.callback("🔄 Test Filters", `highprob:view:${userFilters.timeFilter}`),
            Markup.button.callback("🔙 Back to Menu", "highprob:menu"),
        ],
    ]);

    try {
        await ctx.editMessageText(message, {
            parse_mode: "Markdown",
            reply_markup: keyboard.reply_markup,
        });
        await ctx.answerCbQuery("✅ Filter updated");
    } catch (error: any) {
        if (
            error?.response?.error_code === 400 &&
            error?.response?.description?.includes("message is not modified")
        ) {
            await ctx.answerCbQuery("✅ Filter updated");
        } else {
            console.error("Error updating filters menu:", error);
            await ctx.answerCbQuery("⚠️ Filter updated but couldn't refresh menu");
        }
    }
}

// Missing handler implementations
export async function handleManualMarketToggle(
    ctx: Context,
    marketId: string,
    isSelect: boolean,
    timeFilter: "24h" | "48h",
    offset: number
) {
    const userId = getUserIdFromCtx(ctx);

    try {
        // Get current context
        const context = await redisClient.hGetAll(`user:highprob_context:${userId}`);
        const selectedMarkets = JSON.parse(context.selectedMarkets || "[]");

        let updatedSelection: string[];
        if (isSelect) {
            updatedSelection = [...selectedMarkets, marketId];
        } else {
            updatedSelection = selectedMarkets.filter((id: string) => id !== marketId);
        }

        // Update context
        await redisClient.hSet(`user:highprob_context:${userId}`, {
            mode: "manual",
            timeFilter,
            selectedMarkets: JSON.stringify(updatedSelection),
        });

        // Fetch markets and re-render
        const userFilters = await getUserFilters(userId);
        const filters = { ...userFilters, timeFilter };
        const markets = await fetchHighProbabilityMarkets(filters, 50);

        return sendManualSelectionMarkets(ctx, markets, timeFilter, offset, updatedSelection);
    } catch (error) {
        console.error("Error toggling market selection:", error);
        return ctx.answerCbQuery("❌ Error updating selection");
    }
}

export async function handleManualNavigation(
    ctx: Context,
    timeFilter: "24h" | "48h",
    offset: number
) {
    const userId = getUserIdFromCtx(ctx);

    try {
        // Get current selection
        const context = await redisClient.hGetAll(`user:highprob_context:${userId}`);
        const selectedMarkets = JSON.parse(context.selectedMarkets || "[]");

        // Fetch markets and render new page
        const userFilters = await getUserFilters(userId);
        const filters = { ...userFilters, timeFilter };
        const markets = await fetchHighProbabilityMarkets(filters, 50);

        return sendManualSelectionMarkets(ctx, markets, timeFilter, offset, selectedMarkets);
    } catch (error) {
        console.error("Error navigating markets:", error);
        return ctx.answerCbQuery("❌ Error loading page");
    }
}

export async function handleManualClearSelection(
    ctx: Context,
    timeFilter: "24h" | "48h",
    offset: number
) {
    const userId = getUserIdFromCtx(ctx);

    try {
        // Clear selection
        await redisClient.hSet(`user:highprob_context:${userId}`, {
            mode: "manual",
            timeFilter,
            selectedMarkets: JSON.stringify([]),
        });

        // Fetch markets and re-render
        const userFilters = await getUserFilters(userId);
        const filters = { ...userFilters, timeFilter };
        const markets = await fetchHighProbabilityMarkets(filters, 50);

        return sendManualSelectionMarkets(ctx, markets, timeFilter, offset, []);
    } catch (error) {
        console.error("Error clearing selection:", error);
        return ctx.answerCbQuery("❌ Error clearing selection");
    }
}

export async function handleManualTradeSetup(ctx: Context, timeFilter: "24h" | "48h") {
    const userId = getUserIdFromCtx(ctx);

    try {
        // Get selected markets
        const context = await redisClient.hGetAll(`user:highprob_context:${userId}`);
        const selectedMarketIds = JSON.parse(context.selectedMarkets || "[]");

        if (selectedMarketIds.length === 0) {
            return ctx.reply("❌ No markets selected. Please select markets first.", {
                reply_markup: Markup.inlineKeyboard([
                    [
                        Markup.button.callback(
                            "🔙 Back to Selection",
                            `highprob:manual:${timeFilter}`
                        ),
                    ],
                ]).reply_markup,
            });
        }

        // Store context for input handling
        await redisClient.hSet(`user:highprob_context:${userId}`, {
            mode: "manual",
            timeFilter,
            selectedMarkets: JSON.stringify(selectedMarketIds),
        });

        setUserInputState(userId.toString(), "highprob_manual_amount");

        return ctx.reply(
            `💰 **Enter Amount per Market**\n\n` +
                `You have selected **${selectedMarketIds.length}** markets.\n\n` +
                `Enter the amount you want to invest in each market:\n` +
                `Example: \`20\` (for $20 per market)\n\n` +
                `Total investment will be: $${selectedMarketIds.length} × your amount`,
            {
                parse_mode: "Markdown",
                reply_markup: Markup.inlineKeyboard([
                    [
                        Markup.button.callback(
                            "🔙 Back to Selection",
                            `highprob:manual:${timeFilter}`
                        ),
                    ],
                    [Markup.button.callback("❌ Cancel", "highprob:menu")],
                ]).reply_markup,
            }
        );
    } catch (error) {
        console.error("Error setting up manual trade:", error);
        return ctx.reply("❌ Error setting up trade. Please try again.");
    }
}

export async function handleExecuteTrade(ctx: Context, mode: "autosplit" | "manual") {
    const userId = getUserIdFromCtx(ctx);

    try {
        // Get trade data
        const tradeData = await redisClient.hGetAll(`user:highprob_trade:${userId}`);

        if (!tradeData.mode || tradeData.mode !== mode) {
            return ctx.reply("❌ Trade session expired. Please start over.");
        }

        const marketIds = JSON.parse(tradeData.marketIds || "[]");
        if (marketIds.length === 0) {
            return ctx.reply("❌ No markets found for trade execution.");
        }

        // Clean up stored data
        await redisClient.del(`user:highprob_trade:${userId}`);

        const processingMsg = await ctx.reply("⚡ Executing trades...");

        // Fetch current market data
        const userFilters = await getUserFilters(userId);
        const filters = { ...userFilters, timeFilter: tradeData.timeFilter as "24h" | "48h" };
        const allMarkets = await fetchHighProbabilityMarkets(filters, 100);
        const selectedMarkets = allMarkets.filter((m) => marketIds.includes(m.id));

        if (selectedMarkets.length === 0) {
            await ctx.deleteMessage(processingMsg.message_id);
            return ctx.reply(
                "❌ Selected markets no longer qualify. Market conditions may have changed."
            );
        }

        // Execute batch trades
        let totalAmount: number;
        let maxMarkets: number | undefined;

        if (mode === "autosplit") {
            totalAmount = parseFloat(tradeData.totalAmount);
            maxMarkets = 10;
        } else {
            const amountPerMarket = parseFloat(tradeData.amountPerMarket);
            totalAmount = amountPerMarket * selectedMarkets.length;
        }

        const batchResult = await executeBatchTrades({
            userId,
            totalAmount,
            markets: selectedMarkets,
            maxMarkets,
        });

        await ctx.deleteMessage(processingMsg.message_id);

        // Format results message
        let resultMessage = `${batchResult.success ? "✅" : "❌"} **Trade Execution Complete**\n\n`;

        if (batchResult.successfulTrades.length > 0) {
            resultMessage += `✅ **Successful Trades:** ${batchResult.successfulTrades.length}\n`;
            resultMessage += `💰 **Total Invested:** $${batchResult.totalSuccessfulAmount.toFixed(2)}\n\n`;

            batchResult.successfulTrades.slice(0, 5).forEach((trade, index) => {
                const probability = Math.round(trade.price * 100);
                resultMessage += `${index + 1}. **${trade.outcome.toUpperCase()}** @ ${probability}% - $${trade.amount.toFixed(2)}\n`;
            });

            if (batchResult.successfulTrades.length > 5) {
                resultMessage += `...and ${batchResult.successfulTrades.length - 5} more\n`;
            }
        }

        if (batchResult.failedTrades.length > 0) {
            resultMessage += `\n❌ **Failed Trades:** ${batchResult.failedTrades.length}\n`;
            batchResult.failedTrades.slice(0, 3).forEach((trade, index) => {
                resultMessage += `${index + 1}. ${trade.marketTitle.substring(0, 40)}... - ${trade.error}\n`;
            });
        }

        return ctx.reply(resultMessage, {
            parse_mode: "Markdown",
            reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback("🔙 Back to Menu", "highprob:menu")],
            ]).reply_markup,
        });
    } catch (error) {
        console.error("Error executing trades:", error);
        return ctx.reply("❌ Error executing trades. Please try again.");
    }
}

// Export the main handler to be used in callback dispatcher
export async function handleHighProbCallbackQuery(ctx: Context, data: string) {
    const parts = data.split(":");
    const action = parts[1];
    const params = parts.slice(2);

    return handleHighProbCallback(ctx, action, params);
}

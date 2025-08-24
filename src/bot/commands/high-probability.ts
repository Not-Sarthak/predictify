import { Markup, type Context } from "telegraf";
import { getUserIdFromCtx } from "../utils";
import {
    fetchHighProbabilityMarkets,
    defaultFilters,
    type HighProbFilters,
} from "../../utils/high-prob-trading";
import { formatDollarVolume, escapeMarkdown } from "../utils";
import { redisClient } from "../../lib/redis";
import { getUserLanguage } from "../../helpers/user-language";
import { formatHighProbMarketsList } from "../../utils/message-formatters";
import { t } from "../../i18n";
import type { HighProbMarket } from "../../utils/high-prob-trading";
import { getUserAlertSettings } from "../../notifier/high-prob-alerts";

// Helper function to get user's custom filters or defaults
async function getUserFilters(userId: number): Promise<HighProbFilters> {
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

export async function handleHighProbabilityCommand(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);
    const language = await getUserLanguage(userId);

    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback(
                await t("degenStrategyButton", language),
                "highprob:strategy:degen"
            ),
        ],
        [
            Markup.button.callback(
                await t("turtleStrategyButton", language),
                "highprob:strategy:turtle"
            ),
        ],
    ]);

    const message = `
🎯 **${await t("highProbabilityMarkets", language)}**

${await t("chooseTradingOption", language)}

🔥 **${await t("aggressive", language)}** - ${await t("aggressiveDescription", language)}

🐢 **${await t("conservative", language)}** - ${await t("conservativeDescription", language)}

${await t("selectStrategyPrompt", language)}
    `;

    return ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: keyboard.reply_markup,
    });
}

export async function handleStrategySelection(
    ctx: Context,
    strategy: "degen" | "turtle",
    timeFilter: "24h" | "48h" = "24h"
) {
    const msg = await ctx.reply("🔍 Scanning for high-probability markets...");

    try {
        const userId = getUserIdFromCtx(ctx);
        const userFilters = await getUserFilters(userId);

        // Set strategy-specific probability ranges
        const minProb = strategy === "degen" ? 70 : 85.5;
        const maxProb = strategy === "degen" ? 85 : 95;

        const filters: HighProbFilters = {
            ...userFilters,
            timeFilter,
            tradingMode: strategy === "degen" ? "normal" : "degen", // Map: degen->normal (70-85%), turtle->degen (85.5-95%)
        };

        const markets = await fetchHighProbabilityMarkets(filters, 50);

        await ctx.deleteMessage(msg.message_id);

        if (markets.length === 0) {
            const strategyEmoji = strategy === "degen" ? "🔥" : "🐢";
            const strategyName = strategy === "degen" ? "Degen" : "Turtle";

            return ctx.reply(
                `📊 **No ${strategyName} Markets Found**\n\n` +
                    `No markets found matching ${minProb}-${maxProb}% probability range (${timeFilter}).\n\n` +
                    `Try adjusting filters or check back later.`,
                {
                    parse_mode: "Markdown",
                    reply_markup: Markup.inlineKeyboard([
                        [
                            Markup.button.callback("24h", `highprob:strategy:${strategy}:24h`),
                            Markup.button.callback("48h", `highprob:strategy:${strategy}:48h`),
                        ],
                        [Markup.button.callback("🔙 Back", "highprob:menu")],
                    ]).reply_markup,
                }
            );
        }

        return sendStrategyMarkets(ctx, markets, strategy, timeFilter);
    } catch (error) {
        await ctx.deleteMessage(msg.message_id);
        console.error("Error handling strategy selection:", error);
        return ctx.reply("❌ Error loading markets. Please try again later.");
    }
}

export async function sendStrategyMarkets(
    ctx: Context,
    markets: HighProbMarket[],
    strategy: "degen" | "turtle",
    timeFilter: "24h" | "48h"
) {
    const LIMIT = 8;
    const currentMarkets = markets.slice(0, LIMIT);
    const userId = getUserIdFromCtx(ctx);
    const userFilters = await getUserFilters(userId);
    const language = await getUserLanguage(userId);

    const strategyEmoji = strategy === "degen" ? "🔥" : "🐢";
    const strategyName = strategy === "degen" ? "Degen" : "Turtle";
    const minProb = strategy === "degen" ? 70 : 85.5;
    const maxProb = strategy === "degen" ? 85 : 95;

    let message = `${strategyEmoji} **${strategyName} Strategy** (${minProb}-${maxProb}%)\n\n`;
    message += `📊 **Found ${markets.length} qualifying markets** (${timeFilter})\n\n`;

    // Display markets with numbers
    for (let i = 0; i < currentMarkets.length; i++) {
        const market = currentMarkets[i];
        const prob = Math.round((market.probability || 0) * 100);
        // Try multiple volume sources in order of preference
        const volumeValue = market.volume24hr || market.volume || market.liquidity || 0;
        const volume = formatDollarVolume(volumeValue);

        // Better date handling
        let endTime = t("notAvailable", language);
        if (market.endDate) {
            try {
                const date = new Date(market.endDate);
                if (!isNaN(date.getTime())) {
                    endTime = date.toLocaleDateString();
                }
            } catch (e) {
                endTime = t("notAvailable", language);
            }
        }

        message += `**${i + 1}.** ${escapeMarkdown(market.question || market.title || "Unknown Market")}\n`;
        message += `   💹 ${prob}% • 💧 ${volume} • ⏰ ${endTime}\n\n`;
    }

    // Create time filter toggle buttons
    const timeButtons = [
        Markup.button.callback(
            timeFilter === "24h" ? "✅ 24h" : "24h",
            `highprob:strategy:${strategy}:24h`
        ),
        Markup.button.callback(
            timeFilter === "48h" ? "✅ 48h" : "48h",
            `highprob:strategy:${strategy}:48h`
        ),
    ];

    // Create numbered market buttons
    const marketButtons = currentMarkets.map((market, idx) =>
        Markup.button.callback(
            `#${idx + 1}`,
            `highprob:market:${market.id}:${strategy}:${timeFilter}`
        )
    );

    // Layout market buttons in rows of 4
    const marketButtonRows = [];
    for (let i = 0; i < marketButtons.length; i += 4) {
        marketButtonRows.push(marketButtons.slice(i, i + 4));
    }

    // Create filter and action buttons
    const cryptoStatus = userFilters.excludeCrypto
        ? t("noCrypto", language)
        : t("includeCrypto", language);

    // Get alert status for the button
    const alertSettings = await getUserAlertSettings(userId.toString());
    const alertStatus = alertSettings.enabled ? t("alertsOn", language) : t("alertsOff", language);

    const keyboard = Markup.inlineKeyboard([
        timeButtons,
        [
            Markup.button.callback(
                `🎯 ${t("autoSplitTrade", language)}`,
                `highprob:autosplit:${strategy}:${timeFilter}`
            ),
        ],
        ...marketButtonRows,
        [
            Markup.button.callback(
                cryptoStatus,
                `highprob:toggle_crypto:${strategy}:${timeFilter}`
            ),
            Markup.button.callback(
                alertStatus,
                `highprob:strategy_alerts:${strategy}:${timeFilter}`
            ),
        ],
        [Markup.button.callback("🔙 Back", "highprob:menu")],
    ]);

    return ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: keyboard.reply_markup,
    });
}

export async function handleViewHighProbMarkets(
    ctx: Context,
    timeFilter: "24h" | "48h",
    offset: number = 0
) {
    const msg = await ctx.reply("🔍 Scanning for high-probability markets...");

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
            const minProb = userFilters.tradingMode === "normal" ? 60 : 80;
            const maxProb = userFilters.tradingMode === "normal" ? 85 : 95;

            return ctx.reply(
                `📊 **No High-Probability Markets Found**\n\n` +
                    `No markets currently meet the criteria:\n` +
                    `• Time: ${timeFilter}\n` +
                    `• Probability: ${minProb}-${maxProb}%\n` +
                    `• No crypto or sports markets\n` +
                    `• No very short-term markets (< 30 min)\n` +
                    `• No resolved markets (98%+)\n` +
                    `• No long-term markets (> 7 days)\n` +
                    `• No markets with invalid/missing dates\n\n` +
                    `Try adjusting the filters or check back later.`,
                {
                    parse_mode: "Markdown",
                    reply_markup: Markup.inlineKeyboard([
                        [Markup.button.callback("⚙️ Adjust Filters", "highprob:filters")],
                        [Markup.button.callback("🔙 Back to Menu", "highprob:menu")],
                    ]).reply_markup,
                }
            );
        }

        return sendPaginatedMarkets(ctx, markets, timeFilter, offset);
    } catch (error) {
        await ctx.deleteMessage(msg.message_id);
        console.error("Error fetching high-prob markets:", error);
        return ctx.reply("❌ Error loading markets. Please try again later.", {
            reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback("🔙 Back to Menu", "highprob:menu")],
            ]).reply_markup,
        });
    }
}

export async function sendPaginatedMarkets(
    ctx: Context,
    markets: HighProbMarket[],
    timeFilter: "24h" | "48h",
    offset: number
) {
    const LIMIT = 5;
    const start = offset;
    const end = offset + LIMIT;
    const currentMarkets = markets.slice(start, end);
    const userId = getUserIdFromCtx(ctx);
    const language = await getUserLanguage(userId);

    // Use the message formatter for the market list
    const message = await formatHighProbMarketsList(
        currentMarkets,
        timeFilter,
        start,
        markets.length,
        language
    );

    // Navigation buttons
    const navButtons = [];

    if (offset > 0) {
        navButtons.push(
            Markup.button.callback(
                `⬅️ ${t("previous", language)}`,
                `highprob:view:${timeFilter}:${offset - LIMIT}`
            )
        );
    }

    if (end < markets.length) {
        navButtons.push(
            Markup.button.callback(
                `${t("next", language)} ➡️`,
                `highprob:view:${timeFilter}:${offset + LIMIT}`
            )
        );
    }

    // Action buttons
    const actionButtons = [
        Markup.button.callback(
            `🎯 ${t("autoSplitTrade", language)}`,
            `highprob:autosplit:${timeFilter}`
        ),
        Markup.button.callback(
            `✋ ${t("manualSelection", language)}`,
            `highprob:manual:${timeFilter}`
        ),
    ];

    // Time filter toggle
    const toggleTimeButton =
        timeFilter === "24h"
            ? Markup.button.callback(`📈 ${t("switchTo", language)} 48h`, "highprob:view:48h")
            : Markup.button.callback(`📈 ${t("switchTo", language)} 24h`, "highprob:view:24h");

    const keyboard = Markup.inlineKeyboard([
        actionButtons,
        navButtons,
        [
            toggleTimeButton,
            Markup.button.callback(
                `🔄 ${t("refresh", language)}`,
                `highprob:view:${timeFilter}:${offset}`
            ),
        ],
        [Markup.button.callback(`🔙 ${t("backToMenu", language)}`, "highprob:menu")],
    ]);

    const isPagination =
        ctx.callbackQuery && (ctx.callbackQuery as any)?.data?.includes("highprob:view:");

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

export async function handleHighProbHelp(ctx: Context) {
    const message = `
❓ **High-Probability Markets Explained**

**What are High-Probability Markets?**
Markets with moderate to high probability outcomes, expiring within 24-48 hours.

**Trading Modes & Probability Ranges:**
• **Conservative Mode:** 60-90% probability (balanced risk/reward)
• **Aggressive Mode:** 80-95% probability (higher confidence, lower returns)

**Why These Ranges?**
• **Conservative (60-90%):** Better risk/reward balance, more opportunities
• **Aggressive (80-95%):** Higher confidence but limited profit after slippage
• **24-48h expiry:** Quick resolution, lower time risk

**Quality Filters:**
• **Sports:** Can be excluded or included (user choice)
• **Crypto:** Can be excluded or included (user choice)
• **0DTE:** Excludes markets with less than 30 minutes remaining
• **Resolved:** Excludes markets already at 98%+ probability
• **Long-term:** Excludes markets with no end date or >7 days expiry
• **Invalid dates:** Excludes markets with missing or invalid end dates

**Trading Options:**
• **Auto-Split:** Equal distribution across top markets
• **Manual:** Select specific markets yourself

**Expected Returns:**
Calculated after estimated slippage and fees. Returns vary based on probability and market conditions.

**Risk Considerations:**
• Markets can still resolve unexpectedly
• Lower probability markets = higher risk/reward
• Always trade with money you can afford to lose
• Past performance doesn't guarantee future results
    `;

    return ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback("🔙 Back to Menu", "highprob:menu")],
        ]).reply_markup,
    });
}

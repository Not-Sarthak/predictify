import { Markup, type Context } from "telegraf";
import { getUserIdFromCtx } from "../utils";
import {
    fetchHighProbabilityMarkets,
    DEFAULT_HIGH_PROB_FILTERS,
    type HighProbFilters,
    type HighProbMarket,
} from "../../utils/high-prob-trading";
import { formatDollarVolume, escapeMarkdown } from "../utils";
import { redisClient } from "../../lib/redis";

// Helper function to get user's custom filters or defaults
async function getUserFilters(userId: number): Promise<HighProbFilters> {
    try {
        const userFilters = await redisClient.hGetAll(`user:highprob_filters:${userId}`);

        if (Object.keys(userFilters).length === 0) {
            return DEFAULT_HIGH_PROB_FILTERS;
        }

        return {
            timeFilter:
                (userFilters.timeFilter as "24h" | "48h") || DEFAULT_HIGH_PROB_FILTERS.timeFilter,
            tradingMode:
                (userFilters.tradingMode as "normal" | "degen") ||
                DEFAULT_HIGH_PROB_FILTERS.tradingMode,
            excludeCrypto: true, // Always true
        };
    } catch (error) {
        console.error("Error getting user filters:", error);
        return DEFAULT_HIGH_PROB_FILTERS;
    }
}

export async function handleHighProbabilityCommand(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);
    const userFilters = await getUserFilters(userId);

    const minProb = userFilters.tradingMode === "normal" ? 60 : 80;
    const maxProb = userFilters.tradingMode === "normal" ? 85 : 95;
    const modeText = userFilters.tradingMode === "normal" ? "Conservative" : "Aggressive";

    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback("📈 View Markets (24h)", "highprob:view:24h"),
            Markup.button.callback("📈 View Markets (48h)", "highprob:view:48h"),
        ],
        [
            Markup.button.callback("🎯 Auto-Split Trade", "highprob:autosplit"),
            Markup.button.callback("✋ Manual Selection", "highprob:manual"),
        ],
        [
            Markup.button.callback("⚙️ Adjust Filters", "highprob:filters"),
            Markup.button.callback("❓ What's This?", "highprob:help"),
        ],
    ]);

    const message = `
🎯 **High-Probability Markets Trading**

Target markets with ${minProb}-${maxProb}% probability expiring within 24-48 hours for lower-risk opportunities.

**Current Filters:**
• **Time:** ${userFilters.timeFilter}
• **Probability:** ${minProb}% - ${maxProb}% (${modeText})
• **Crypto Markets:** Excluded
• **Sports Markets:** Excluded
• **0DTE Markets:** Excluded (< 1 hour)
• **Resolved Markets:** Excluded (100% probability)

Choose an option below to get started:
    `;

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
                    `• No 0DTE markets (< 1 hour)\n` +
                    `• No resolved markets (100%)\n\n` +
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

    let message = `🎯 **High-Probability Markets (${timeFilter})**\n`;
    message += `📊 Found ${markets.length} qualifying markets\n\n`;

    currentMarkets.forEach((market, index) => {
        const marketNum = start + index + 1;
        const probability = Math.round(market.probability * 100);
        const expectedReturn = market.expectedReturn.toFixed(1);
        const volume = formatDollarVolume(market.volume || 0);
        const hoursLeft = Math.round(market.hoursUntilExpiry);

        message += `**${marketNum}.** ${escapeMarkdown(market.question.substring(0, 80))}${market.question.length > 80 ? "..." : ""}\n`;
        message += `🎯 **${market.bestOutcome.toUpperCase()}** @ ${probability}% • ⏰ ${hoursLeft}h left\n`;
        message += `💰 Vol: ${volume} • 📈 Return: +${expectedReturn}%\n\n`;
    });

    // Navigation buttons
    const navButtons = [];

    if (offset > 0) {
        navButtons.push(
            Markup.button.callback("⬅️ Previous", `highprob:view:${timeFilter}:${offset - LIMIT}`)
        );
    }

    if (end < markets.length) {
        navButtons.push(
            Markup.button.callback("Next ➡️", `highprob:view:${timeFilter}:${offset + LIMIT}`)
        );
    }

    // Action buttons
    const actionButtons = [
        Markup.button.callback("🎯 Auto-Split All", `highprob:autosplit:${timeFilter}`),
        Markup.button.callback("✋ Select Markets", `highprob:manual:${timeFilter}`),
    ];

    // Time filter toggle
    const toggleTimeButton =
        timeFilter === "24h"
            ? Markup.button.callback("📈 Switch to 48h", "highprob:view:48h")
            : Markup.button.callback("📈 Switch to 24h", "highprob:view:24h");

    const keyboard = Markup.inlineKeyboard([
        actionButtons,
        navButtons,
        [
            toggleTimeButton,
            Markup.button.callback("🔄 Refresh", `highprob:view:${timeFilter}:${offset}`),
        ],
        [Markup.button.callback("🔙 Back to Menu", "highprob:menu")],
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
• **Conservative Mode:** 60-85% probability (safer, steadier returns)
• **Aggressive Mode:** 80-95% probability (higher confidence, lower returns)

**Why These Ranges?**
• **Conservative (60-85%):** Better risk/reward balance, more opportunities
• **Aggressive (80-95%):** Higher confidence but limited profit after slippage
• **24-48h expiry:** Quick resolution, lower time risk

**Quality Filters:**
• **No Sports:** Excludes sports markets which can be unpredictable
• **No Crypto:** Excludes volatile crypto price prediction markets
• **No 0DTE:** Excludes markets with less than 1 hour remaining
• **No Resolved:** Excludes markets already at 100% probability

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

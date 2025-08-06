import { Markup, type Context } from "telegraf";
import { getUserIdFromCtx } from "@/bot/utils";
import {
    fetchHighProbabilityMarkets,
    DEFAULT_HIGH_PROB_FILTERS,
    type HighProbFilters,
    type HighProbMarket,
} from "@/utils/high-prob-trading";
import { formatDollarVolume, escapeMarkdown } from "@/bot/utils";
import { redisClient } from "@/lib/redis";

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
            minVolume: parseInt(userFilters.minVolume) || DEFAULT_HIGH_PROB_FILTERS.minVolume,
            minLiquidityWithin2Percent:
                parseInt(userFilters.minLiquidityWithin2Percent) ||
                DEFAULT_HIGH_PROB_FILTERS.minLiquidityWithin2Percent,
            minProbability:
                parseFloat(userFilters.minProbability) || DEFAULT_HIGH_PROB_FILTERS.minProbability,
            maxProbability:
                parseFloat(userFilters.maxProbability) || DEFAULT_HIGH_PROB_FILTERS.maxProbability,
            excludeCrypto: userFilters.excludeCrypto === "true",
        };
    } catch (error) {
        console.error("Error getting user filters:", error);
        return DEFAULT_HIGH_PROB_FILTERS;
    }
}

export async function handleHighProbabilityCommand(ctx: Context) {
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

Target markets with 85-95% probability expiring within 24-48 hours for lower-risk opportunities.

**Current Filters:**
• **Time:** 24 hours (default)
• **Min Volume:** $70,000
• **Min Liquidity:** $200 within 2% spread
• **Probability:** 85% - 95%
• **Crypto Markets:** Excluded

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
            return ctx.reply(
                `📊 **No High-Probability Markets Found**\n\n` +
                    `No markets currently meet the criteria:\n` +
                    `• Time: ${timeFilter}\n` +
                    `• Volume: ≥$70,000\n` +
                    `• Probability: 85-95%\n` +
                    `• Sufficient liquidity\n\n` +
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
Markets with 85-95% probability of a specific outcome, expiring within 24-48 hours.

**Why This Range?**
• **Above 95%:** Minimal profit potential after slippage
• **Below 85%:** Higher risk territory
• **24-48h expiry:** Quick resolution, lower time risk

**Quality Filters:**
• **Min Volume:** $70,000+ (ensures market activity)
• **Liquidity:** $200+ within 2% spread (better execution)
• **No Crypto:** Excludes volatile crypto markets

**Trading Modes:**
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

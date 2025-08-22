import { Markup, type Context } from "telegraf";
import { getUserIdFromCtx } from "../utils";
import {
    fetchHighProbabilityMarkets,
    defaultFilters,
    type HighProbFilters,
    type HighProbMarket,
} from "../../utils/high-prob-trading";
import { formatDollarVolume, escapeMarkdown } from "../utils";
import { redisClient } from "../../lib/redis";
import { getUserLanguage } from "../../helpers/user-language";
import { formatHighProbMarketsList } from "../../utils/message-formatters";
import { t } from "../../i18n";

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
    const userFilters = await getUserFilters(userId);
    const language = await getUserLanguage(userId);

    const minProb = userFilters.tradingMode === "normal" ? 60 : 80;
    const maxProb = userFilters.tradingMode === "normal" ? 90 : 95;
    const modeText =
        userFilters.tradingMode === "normal"
            ? t("conservative", language)
            : t("aggressive", language);

    const cryptoStatus = userFilters.excludeCrypto
        ? t("excluded", language)
        : t("included", language);

    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback(`📈 ${t("viewMarkets", language)} (24h)`, "highprob:view:24h"),
            Markup.button.callback(`📈 ${t("viewMarkets", language)} (48h)`, "highprob:view:48h"),
        ],
        [
            Markup.button.callback(`🎯 ${t("autoSplitTrade", language)}`, "highprob:autosplit"),
            Markup.button.callback(`✋ ${t("manualSelection", language)}`, "highprob:manual"),
        ],
        [
            Markup.button.callback(`⚙️ ${t("adjustFilters", language)}`, "highprob:filters"),
            Markup.button.callback(`❓ ${t("whatIsThis", language)}`, "highprob:help"),
        ],
    ]);

    const message = `
🎯 **${t("highProbabilityMarkets", language)}**

${t("highProbDescription", language)} ${minProb}-${maxProb}% ${t("probabilityRange", language)}.

${t("chooseOption", language)}:
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
                    `• No very short-term markets (< 30 min)\n` +
                    `• No resolved markets (98%+)\n\n` +
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

import { type Context } from "telegraf";
import { getUserIdFromCtx } from "../utils";
import { clearUserInputState } from "../input/state";
import { redisClient } from "../../lib/redis";
import {
    fetchHighProbabilityMarkets,
    validateBatchTrade,
    DEFAULT_HIGH_PROB_FILTERS,
    type HighProbFilters,
} from "../../utils/high-prob-trading";
import { Markup } from "telegraf";

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

export async function handleHighProbAutoSplitAmount(ctx: Context, textMessage: string) {
    const userId = getUserIdFromCtx(ctx);

    try {
        // Parse and validate amount
        const amount = parseFloat(textMessage.trim());

        if (isNaN(amount) || amount <= 0) {
            return ctx.reply("❌ Invalid amount. Please enter a valid number.\nExample: `100`", {
                parse_mode: "Markdown",
            });
        }

        if (amount < 10) {
            return ctx.reply("❌ Minimum total amount is $10.\nExample: `100`", {
                parse_mode: "Markdown",
            });
        }

        // Get context
        const context = await redisClient.hGetAll(`user:highprob_context:${userId}`);
        if (!context.mode || context.mode !== "autosplit") {
            clearUserInputState(userId.toString());
            return ctx.reply("❌ Session expired. Please start over.", {
                reply_markup: Markup.inlineKeyboard([
                    [Markup.button.callback("🔙 Back to Menu", "highprob:menu")],
                ]).reply_markup,
            });
        }

        const timeFilter = (context.timeFilter as "24h" | "48h") || "24h";
        const marketCount = parseInt(context.marketCount) || 10;

        clearUserInputState(userId.toString());

        const processingMsg = await ctx.reply("🔍 Preparing auto-split trade...");

        // Fetch current markets
        const userFilters = await getUserFilters(userId);
        const filters: HighProbFilters = {
            ...userFilters,
            timeFilter,
        };

        const markets = await fetchHighProbabilityMarkets(filters, 50);
        const selectedMarkets = markets.slice(0, marketCount);

        if (selectedMarkets.length === 0) {
            await ctx.deleteMessage(processingMsg.message_id);
            return ctx.reply("❌ No qualifying markets found. Market conditions may have changed.");
        }

        // Validate trade
        const validation = await validateBatchTrade({
            userId,
            totalAmount: amount,
            markets: selectedMarkets,
            maxMarkets: marketCount,
        });

        if (!validation.valid) {
            await ctx.deleteMessage(processingMsg.message_id);
            return ctx.reply(`❌ **Cannot Execute Trade**\n\n${validation.error}`, {
                parse_mode: "Markdown",
                reply_markup: Markup.inlineKeyboard([
                    [Markup.button.callback("🔙 Back to Menu", "highprob:menu")],
                ]).reply_markup,
            });
        }

        const actualMarketCount = Math.min(marketCount, selectedMarkets.length);
        const amountPerMarket = (amount / actualMarketCount).toFixed(2);

        await ctx.deleteMessage(processingMsg.message_id);

        // Show confirmation
        let confirmMessage = `🎯 **Auto-Split Trade Confirmation**\n\n`;
        confirmMessage += `**Total Amount:** $${amount}\n`;
        confirmMessage += `**Markets:** ${actualMarketCount}\n`;
        confirmMessage += `**Per Market:** $${amountPerMarket}\n`;
        confirmMessage += `**Time Filter:** ${timeFilter}\n\n`;

        confirmMessage += `**Markets to Trade:**\n`;
        selectedMarkets.slice(0, 5).forEach((market, index) => {
            const probability = Math.round(market.probability * 100);
            confirmMessage += `${index + 1}. ${market.bestOutcome.toUpperCase()} @ ${probability}%\n`;
        });

        if (selectedMarkets.length > 5) {
            confirmMessage += `...and ${selectedMarkets.length - 5} more\n`;
        }

        confirmMessage += `\n⚠️ **Confirm to execute all trades**`;

        // Store trade data for confirmation
        await redisClient.hSet(`user:highprob_trade:${userId}`, {
            mode: "autosplit",
            totalAmount: amount.toString(),
            marketIds: JSON.stringify(selectedMarkets.map((m) => m.id)),
            timeFilter,
        });

        return ctx.reply(confirmMessage, {
            parse_mode: "Markdown",
            reply_markup: Markup.inlineKeyboard([
                [
                    Markup.button.callback("✅ Confirm Trade", "highprob:execute:autosplit"),
                    Markup.button.callback("❌ Cancel", "highprob:menu"),
                ],
            ]).reply_markup,
        });
    } catch (error) {
        clearUserInputState(userId.toString());
        console.error("Error handling auto-split amount:", error);
        return ctx.reply("❌ An error occurred. Please try again.");
    }
}

export async function handleHighProbManualAmount(ctx: Context, textMessage: string) {
    const userId = getUserIdFromCtx(ctx);

    try {
        // Parse and validate amount
        const amount = parseFloat(textMessage.trim());

        if (isNaN(amount) || amount <= 0) {
            return ctx.reply("❌ Invalid amount. Please enter a valid number.\nExample: `50`", {
                parse_mode: "Markdown",
            });
        }

        if (amount < 5) {
            return ctx.reply("❌ Minimum amount per market is $5.\nExample: `50`", {
                parse_mode: "Markdown",
            });
        }

        // Get context
        const context = await redisClient.hGetAll(`user:highprob_context:${userId}`);
        if (!context.mode || context.mode !== "manual") {
            clearUserInputState(userId.toString());
            return ctx.reply("❌ Session expired. Please start over.", {
                reply_markup: Markup.inlineKeyboard([
                    [Markup.button.callback("🔙 Back to Menu", "highprob:menu")],
                ]).reply_markup,
            });
        }

        const selectedMarketIds = JSON.parse(context.selectedMarkets || "[]");
        if (selectedMarketIds.length === 0) {
            clearUserInputState(userId.toString());
            return ctx.reply("❌ No markets selected. Please select markets first.", {
                reply_markup: Markup.inlineKeyboard([
                    [
                        Markup.button.callback(
                            "🔙 Back to Selection",
                            `highprob:manual:${context.timeFilter}`
                        ),
                    ],
                ]).reply_markup,
            });
        }

        const timeFilter = (context.timeFilter as "24h" | "48h") || "24h";

        clearUserInputState(userId.toString());

        const processingMsg = await ctx.reply("🔍 Preparing manual trades...");

        // Fetch current markets to get latest data
        const userFilters = await getUserFilters(userId);
        const filters: HighProbFilters = {
            ...userFilters,
            timeFilter,
        };

        const allMarkets = await fetchHighProbabilityMarkets(filters, 100);
        const selectedMarkets = allMarkets.filter((m) => selectedMarketIds.includes(m.id));

        if (selectedMarkets.length === 0) {
            await ctx.deleteMessage(processingMsg.message_id);
            return ctx.reply(
                "❌ Selected markets no longer qualify. Market conditions may have changed."
            );
        }

        // Validate trade
        const validation = await validateBatchTrade({
            userId,
            totalAmount: amount,
            markets: selectedMarkets,
        });

        if (!validation.valid) {
            await ctx.deleteMessage(processingMsg.message_id);
            return ctx.reply(`❌ **Cannot Execute Trade**\n\n${validation.error}`, {
                parse_mode: "Markdown",
                reply_markup: Markup.inlineKeyboard([
                    [Markup.button.callback("🔙 Back to Menu", "highprob:menu")],
                ]).reply_markup,
            });
        }

        await ctx.deleteMessage(processingMsg.message_id);

        // Show confirmation
        let confirmMessage = `✋ **Manual Trade Confirmation**\n\n`;
        confirmMessage += `**Amount per Market:** $${amount}\n`;
        confirmMessage += `**Selected Markets:** ${selectedMarkets.length}\n`;
        confirmMessage += `**Total Amount:** $${(amount * selectedMarkets.length).toFixed(2)}\n\n`;

        confirmMessage += `**Markets to Trade:**\n`;
        selectedMarkets.forEach((market, index) => {
            const probability = Math.round(market.probability * 100);
            confirmMessage += `${index + 1}. ${market.bestOutcome.toUpperCase()} @ ${probability}% - $${amount}\n`;
        });

        confirmMessage += `\n⚠️ **Confirm to execute all trades**`;

        // Store trade data for confirmation
        await redisClient.hSet(`user:highprob_trade:${userId}`, {
            mode: "manual",
            amountPerMarket: amount.toString(),
            marketIds: JSON.stringify(selectedMarkets.map((m) => m.id)),
            timeFilter,
        });

        return ctx.reply(confirmMessage, {
            parse_mode: "Markdown",
            reply_markup: Markup.inlineKeyboard([
                [
                    Markup.button.callback("✅ Confirm Trade", "highprob:execute:manual"),
                    Markup.button.callback("❌ Cancel", "highprob:menu"),
                ],
            ]).reply_markup,
        });
    } catch (error) {
        clearUserInputState(userId.toString());
        console.error("Error handling manual amount:", error);
        return ctx.reply("❌ An error occurred. Please try again.");
    }
}

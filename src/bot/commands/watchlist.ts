import { Markup, type Context } from "telegraf";
import { getUserIdFromCtx } from "../utils";
import { db } from "../../lib/supabase";
import { getMarketById } from "../../utils/polymarket/get-markets";
import { formatDate, formatDollarVolume, escapeMarkdown } from "../utils";

export async function handleWatchlistCommand(ctx: Context, page: number = 0) {
    const userId = getUserIdFromCtx(ctx);
    const MARKETS_PER_PAGE = 5;
    const currentPage = typeof page === "number" ? page : 0;

    try {
        const { data: user, error } = await db("Users")
            .select("market_watchlist")
            .eq("id", userId)
            .single();

        if (error || !user) {
            console.error("Error fetching user watchlist:", error);
            return ctx.reply("❌ Error fetching your watchlist. Please try again later.");
        }

        const allWatchedMarkets = user.market_watchlist || [];

        if (allWatchedMarkets.length === 0) {
            return ctx.reply(
                "❤️ **Your Watchlist is Empty**\n\n" +
                    "Add markets to your watchlist to track them easily.\n\n" +
                    "You can add markets by clicking the '❤️ Add to My Watchlist' button when viewing any market.",
                { parse_mode: "Markdown" }
            );
        }

        const startIndex = currentPage * MARKETS_PER_PAGE;
        const endIndex = startIndex + MARKETS_PER_PAGE;
        const totalPages = Math.ceil(allWatchedMarkets.length / MARKETS_PER_PAGE);

        const watchedMarketsPage = allWatchedMarkets.slice(startIndex, endIndex);

        const marketPromises = watchedMarketsPage.map(async (marketData: any) => {
            try {
                if (!marketData) {
                    return null;
                }

                const marketId = marketData.marketId || marketData.id;
                if (!marketId) {
                    if (marketData.conditionId && marketData.question) {
                        return {
                            ...marketData,
                            id: marketData.conditionId,
                            marketId: marketData.conditionId,
                        };
                    }
                    return null;
                }

                let freshData = null;
                try {
                    freshData = await getMarketById(marketId.toString());
                } catch (error) {
                    // Use stored data if fetch fails
                }

                if (freshData) {
                    return {
                        ...marketData,
                        ...freshData,
                        id: marketId,
                        marketId: marketId,
                    };
                }

                return {
                    ...marketData,
                    id: marketId,
                    marketId: marketId,
                };
            } catch (error) {
                return {
                    ...marketData,
                    id: marketData.marketId || marketData.conditionId,
                    marketId: marketData.marketId || marketData.conditionId,
                };
            }
        });

        const markets = await Promise.all(marketPromises);

        const validMarkets = markets.filter((market) => {
            if (!market) {
                return false;
            }
            const hasId = !!(market.marketId || market.id || market.conditionId);
            const hasTitle = !!(market.question || market.title);
            return hasId && hasTitle;
        });

        if (validMarkets.length === 0) {
            return ctx.reply(
                "❤️ **Your Watchlist**\n\n" + "Unable to display markets. Please try again later.",
                { parse_mode: "Markdown" }
            );
        }

        let message = `❤️ **Your Watchlist** (${allWatchedMarkets.length}/20) - Page ${currentPage + 1}/${totalPages}\n\n`;

        validMarkets.forEach((market, index) => {
            const globalIndex = startIndex + index + 1;

            let yesPrice = 0,
                noPrice = 0,
                volume = 0;

            if (market.outcomePrices) {
                try {
                    const outcomes: number[] =
                        typeof market.outcomePrices === "string"
                            ? JSON.parse(market.outcomePrices)
                            : market.outcomePrices;
                    yesPrice = Number(outcomes[0]) || 0;
                    noPrice = Number(outcomes[1]) || 0;
                } catch (e) {
                    // Parse error - prices remain 0
                }
            }

            yesPrice = Number(yesPrice) || 0;
            noPrice = Number(noPrice) || 0;

            if (market.volumeNum !== undefined) {
                volume = market.volumeNum;
            } else if (market.volume1mo !== undefined) {
                volume = market.volume1mo;
            } else if (market.volume !== undefined) {
                volume = market.volume;
            }

            const volumeStr = volume > 0 ? formatDollarVolume(volume) : "N/A";
            const endDate = market.endDate ? formatDate(market.endDate) : "Unknown";
            const title = market.question || market.title || "Unknown Market";

            message += `${globalIndex}. **${escapeMarkdown(title)}**\n`;

            if (yesPrice > 0 || noPrice > 0) {
                message += `   💹 Yes: $${yesPrice.toFixed(2)} | No: $${noPrice.toFixed(2)}\n`;
            } else {
                message += `   💹 Prices: *Refresh for latest*\n`;
            }

            message += `   💧 Volume: ${volumeStr} | ⏰ Ends: ${endDate}\n\n`;
        });

        const marketButtons = validMarkets.map((market, idx) =>
            Markup.button.callback(
                `${startIndex + idx + 1}`,
                `watchlist_market:${market.marketId || market.id}`
            )
        );

        const buttonRows = [];

        for (let i = 0; i < marketButtons.length; i += 5) {
            buttonRows.push(marketButtons.slice(i, i + 5));
        }

        const paginationButtons = [];
        if (currentPage > 0) {
            paginationButtons.push(
                Markup.button.callback("⏮️ Previous", `watchlist_page:${currentPage - 1}`)
            );
        }
        if (endIndex < allWatchedMarkets.length) {
            paginationButtons.push(
                Markup.button.callback("Next ⏭️", `watchlist_page:${currentPage + 1}`)
            );
        }

        if (paginationButtons.length > 0) {
            buttonRows.push(paginationButtons);
        }

        buttonRows.push([
            Markup.button.callback("🔄 Refresh", `watchlist_page:${currentPage}`),
            Markup.button.callback("🗑️ Clear All", "clear_watchlist"),
        ]);

        buttonRows.push([Markup.button.callback("❌ Close", "close_message")]);

        return ctx.reply(message, {
            parse_mode: "Markdown",
            reply_markup: Markup.inlineKeyboard(buttonRows).reply_markup,
        });
    } catch (error) {
        console.error("Error in handleWatchlistCommand:", error);
        return ctx.reply(
            "❌ An error occurred while fetching your watchlist. Please try again later."
        );
    }
}

import { TRADE_MENU_BUTTONS } from "../ui/buttons";
import {
    manageUserCopyTrade,
    escapeMarkdown,
    formatCurrentTradePositionsMessage,
    formatDate,
    formatDollarVolume,
    getUserByIdFromDb,
    getUserIdFromCtx,
    layoutButtons,
    formatOrderBook,
    formatSinglePositionMessage,
    getUsernameFromCtx,
    detectSymbolFromSlug,
} from "../utils";
import { getUserAddressFromId } from "../../helpers/get-user-address-from-id";
import { getUserDetails } from "../../helpers/get-user-details";
import { redisClient } from "../../lib/redis";
import { CATEGORY_LIST, MARKET_FILTERS } from "../../shared/constants";
import { capitalize } from "../../utils/capitalize";
import {
    fetchMarkets,
    getMarketByConditionId,
    getMarketById,
    getMarketOrderBook,
} from "../../utils/polymarket/get-markets";
import { getUserPosition, getUserPositionByMarket } from "../../utils/polymarket/get-user-position";
import { Markup, type Context } from "telegraf";
import axios from "axios";
import { db } from "../../lib/supabase";
import { generateClosePositionButton } from "../ui/buttons/trade";
import { marketSellOrder } from "../../utils/polymarket-order/market-buy-order";
import { OrderType } from "@polymarket/clob-client";
import { decodeMarketId, encodeMarketConditionId } from "../../utils/encoding";
import { decryptPrivateKey } from "../../utils/crypto";
import { cancelOrder } from "../../utils/polymarket-order/cancel-order";
import type { ApiKeyCreds } from "../../types/polymarket";
import { setUserInputState } from "../input/state";
import { generatePnlCard, generatePortfolioPositionCard } from "../../utils/card-generator";

import { trackManualTrade } from "../../utils/trade-tracker";
import { updateUserVolume } from "../../helpers/update-user-volume";
import { stopWalletMonitoring } from "../../watcher/copy-trade";
import {
    startTpSlWatcher,
    stopAllTpSlWatchers,
    type PriceWatchConfig,
} from "../../notifier/ws/price-watcher";
import { DateTime } from "luxon";
import { getCurrentTokenPrice, getTokenPriceAtMarketStart } from "../../utils/binance/binance";

export async function handleTradeMenu(ctx: Context) {
    return ctx.editMessageReplyMarkup(Markup.inlineKeyboard(TRADE_MENU_BUTTONS).reply_markup);
}

export async function handleTradeCallbacks(ctx: Context, action: string, marketId: string) {
    if (action === "yes") {
        await ctx.answerCbQuery("✅ Buy Yes Clicked");
        return ctx.reply(`🟢 You Chose to Buy Yes on Market: ${marketId}`);
    } else if (action === "no") {
        await ctx.answerCbQuery("❌ Buy No Clicked");
        return ctx.reply(`🔴 You Chose to Buy No on Market: ${marketId}`);
    }

    return ctx.answerCbQuery();
}

export async function handleViewTopMarketsCallback(ctx: Context) {
    const tradeCategoriesButtons = CATEGORY_LIST.map((cat) =>
        Markup.button.callback(cat, `view_top_markets:${cat}`)
    );

    const layout = [
        tradeCategoriesButtons.slice(0, 3),
        tradeCategoriesButtons.slice(3, 6),
        tradeCategoriesButtons.slice(6, 9),
        tradeCategoriesButtons.slice(9, 12),
    ];

    return ctx.reply("🔥 Trending Markets: ", {
        reply_markup: Markup.inlineKeyboard(layout).reply_markup,
    });
}

export async function handleCloseTradePositions(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);
    const userAddress = await getUserAddressFromId(userId);

    if (!userAddress) {
        return ctx.reply("⚠️ No Associated Wallet Address Found With Your Account!");
    }

    const userPositions = await getUserPosition({ user: userAddress });

    if (userPositions.length === 0) {
        if (ctx.callbackQuery) {
            await ctx.answerCbQuery();
        }
        return ctx.reply("⚠️ No Open Positions From Your Account!");
    }

    const conditionIds = userPositions.map((position) => position.conditionId);
    const getMarketByConditionIdPromises = conditionIds.map((conditionId) =>
        getMarketByConditionId(conditionId)
    );

    const markets = await Promise.all(getMarketByConditionIdPromises);
    if (!markets) {
        return ctx.reply("❌ Internal Server Error");
    }

    const openMarkets = markets.filter(
        (market) => market && !market.closed && market.acceptingOrders !== false
    );
    if (openMarkets.length === 0) {
        return ctx.reply("⚠️ No Open Markets Found in Your Positions.");
    }

    const formattedUserPositionsMessages = formatCurrentTradePositionsMessage(userPositions);
    const replyPromises = formattedUserPositionsMessages.map((data) =>
        ctx.reply(data.message, {
            parse_mode: "Markdown",
            reply_markup: Markup.inlineKeyboard([
                generateClosePositionButton(encodeMarketConditionId(data.marketId)),
            ]).reply_markup,
        })
    );

    await Promise.all(replyPromises);
}

export async function handleViewTradePositions(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);
    const userAddress = await getUserAddressFromId(userId);

    if (!userAddress) {
        return ctx.reply("⚠️ No Associated Wallet Address Found With Your Account!");
    }

    const userPositions = await getUserPosition({ user: userAddress });
    const filteredUserPositions = userPositions.filter((position) => !position.redeemable);

    if (filteredUserPositions.length === 0) {
        return ctx.reply("⚠️ No Open Positions From Your Account!");
    }

    const { text, markup } = await formatSinglePositionMessage(
        userId.toString(),
        filteredUserPositions[0],
        0,
        filteredUserPositions.length
    );

    await ctx.reply(text, {
        parse_mode: "Markdown",
        reply_markup: markup,
    });
}

export async function handleTradePagination(ctx: Context, page: string) {
    const userId = getUserIdFromCtx(ctx);
    const userAddress = await getUserAddressFromId(userId);

    if (!userAddress) {
        return ctx.answerCbQuery("No Wallet Linked");
    }

    const userPositions = await getUserPosition({ user: userAddress });
    const filteredUserPositions = userPositions.filter((position) => !position.redeemable);

    const pageIndex = parseInt(page);
    const position = filteredUserPositions[pageIndex];

    if (!position) return ctx.answerCbQuery("Page not found");

    const { text, markup } = await formatSinglePositionMessage(
        userId.toString(),
        position,
        pageIndex,
        filteredUserPositions.length
    );

    return ctx.editMessageText(text, {
        parse_mode: "Markdown",
        reply_markup: markup,
    });
}

export async function handleManageTradePositionsCallback(ctx: Context, action: string) {
    const userId = getUserIdFromCtx(ctx);

    await setUserInputState(userId.toString(), "marketTerm");
    await redisClient.hSet(`user:order_action:${userId}`, {
        action: action === "open" ? "OPEN" : "CLOSE",
    });

    return ctx.reply(
        `✍️ **Enter a Term to Search**\n\n` +
            `<term>\n\n` +
            `Example:\n\`basketball\`\n\n` +
            `You Can Enter Any Keyword to Get Relevant Results.`,
        { parse_mode: "Markdown" }
    );
}

export async function handleViewTopMarketsByCategory(
    ctx: Context,
    marketCategory: string,
    filter: string = "volume",
    offset: number = 0
) {
    const LIMIT = 8;
    let message = `🔥 Top Markets for *${marketCategory.charAt(0).toUpperCase() + marketCategory.slice(1)}* — _${capitalize(filter)}_\n\n`;
    const markets = await fetchMarkets(marketCategory, filter, offset);

    const filteredMarkets =
        filter === "volume" ? markets.filter((m) => m.volume24hr && m.volume24hr > 0) : markets;

    if (filteredMarkets.length === 0) {
        return ctx.reply("⚠️ No Available Markets!");
    }

    for (let i = 0; i < filteredMarkets.length; i++) {
        const market = filteredMarkets[i];
        const fDate = formatDate(market.endDate);
        const fVolumne = formatDollarVolume(market.volume1mo || 0);

        message += `${i + 1}. *${escapeMarkdown(market.title)}*
💧 Volume : ${fVolumne}
⌛ Ends: ${fDate}

`;
    }

    const filterButtons = MARKET_FILTERS.map((marketFilter) =>
        Markup.button.callback(
            marketFilter.split(" ")[1].toLowerCase() === filter
                ? `✅ ${marketFilter}`
                : `   ${marketFilter}`,
            `filter_top_market:${marketCategory}:${marketFilter.split(" ")[1].toLowerCase()}`
        )
    );

    const paginationButtons = [];

    if (offset > 0) {
        paginationButtons.push(
            Markup.button.callback(
                "⏮️ Prev",
                `filter_top_market:${marketCategory}:${filter}:${offset - LIMIT}`
            )
        );
    }

    if (filteredMarkets.length === LIMIT) {
        paginationButtons.push(
            Markup.button.callback(
                "Next ⏭️",
                `filter_top_market:${marketCategory}:${filter}:${offset + LIMIT}`
            )
        );
    }

    const marketButtons = filteredMarkets.map((market, idx) =>
        Markup.button.callback(`#${idx + 1}`, `view_markets:${market.id}`)
    );

    const marketButtonsLayout = layoutButtons(marketButtons);

    const keyboard = Markup.inlineKeyboard([
        filterButtons.slice(0, 3),
        filterButtons.slice(3),
        ...marketButtonsLayout,
        paginationButtons,
        [
            Markup.button.callback(
                "🔄 Refresh",
                `refresh_top_markets:${marketCategory}:${filter}:${offset}`
            ),
            Markup.button.callback("❌ Close", "close_message"),
        ],
    ]);

    if (ctx.updateType === "callback_query") {
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
                await ctx.answerCbQuery("⚠️ Failed to Update the Message.");
            }
        }

        return;
    }

    return ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: keyboard.reply_markup,
    });
}

export async function handleShowZeroDTEMarketsByCategory(
    ctx: Context,
    category: string,
    offset: number = 0
) {
    const LIMIT = 8;
    const filter = "0dte";
    let message = `⚡ Top 0DTE Markets for **${category.charAt(0).toUpperCase() + category.slice(1)}**\n\n`;

    const markets = await fetchMarkets(category, filter, offset);

    const filteredMarkets = markets.filter((m) => m.volume24hr && m.volume24hr > 0);

    if (filteredMarkets.length === 0) {
        return ctx.reply("⚠️ No Available 0DTE Markets!");
    }

    for (let i = 0; i < filteredMarkets.length; i++) {
        const market = filteredMarkets[i];
        const fDate = formatDate(market.endDate);
        const fVol = formatDollarVolume(market.volume1mo || 0);

        message += `${i + 1}. **${escapeMarkdown(market.title)}**
💧 Volume: ${fVol}
⌛ Ends: ${fDate}

`;
    }

    const paginationButtons = [];

    if (offset > 0) {
        paginationButtons.push(
            Markup.button.callback("⏮️ Prev", `zero_dte_category:${category}:${offset - LIMIT}`)
        );
    }

    if (filteredMarkets.length === LIMIT) {
        paginationButtons.push(
            Markup.button.callback("Next ⏭️", `zero_dte_category:${category}:${offset + LIMIT}`)
        );
    }

    const marketButtons = filteredMarkets.map((market, idx) =>
        Markup.button.callback(`#${idx + 1}`, `view_markets:${market.id}`)
    );

    const marketButtonsLayout = layoutButtons(marketButtons);

    const keyboard = Markup.inlineKeyboard([
        ...marketButtonsLayout,
        paginationButtons,
        [Markup.button.callback("🔄 Refresh", `zero_dte_category:${category}:${offset}`)],
        [
            Markup.button.callback("⬅️ Back", "back_to_zero_dte_categories"),
            Markup.button.callback("❌ Close", "close_message"),
        ],
    ]);

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
            await ctx.answerCbQuery("⚠️ Failed to Update the Message.");
        }
    }

    return;
}

// export async function handleShowZeroDTEMarkets(ctx: Context, offset: number = 0) {
//     const LIMIT = 8;
//     let message = `🔥 Top Markets for **${marketCategory.charAt(0).toUpperCase() + marketCategory.slice(1)}** — _${capitalize(filter)}_\n\n`;

//     const markets = await fetchMarkets(marketCategory, filter, offset);

//     const filteredMarkets =
//         filter === "volume" ? markets.filter((m) => m.volume24hr && m.volume24hr > 0) : markets;

//     if (filteredMarkets.length === 0) {
//         return ctx.reply("⚠️ No Available Markets!");
//     }

//     for (let i = 0; i < filteredMarkets.length; i++) {
//         const market = filteredMarkets[i];
//         const fDate = formatDate(market.endDate);
//         const fVolumne = formatDollarVolume(market.volume1mo || 0);

//         message += `${i + 1}. **${market.title}**
// 💧 Volume : ${fVolumne}
// ⌛ Ends: ${fDate}

// `;
//     }

//     const paginationButtons = [];

//     if (offset > 0) {
//         paginationButtons.push(
//             Markup.button.callback(
//                 "⏮️ Prev",
//                 `filter_top_market:${marketCategory}:${filter}:${offset - LIMIT}`
//             )
//         );
//     }

//     if (filteredMarkets.length === LIMIT) {
//         paginationButtons.push(
//             Markup.button.callback(
//                 "Next ⏭️",
//                 `filter_top_market:${marketCategory}:${filter}:${offset + LIMIT}`
//             )
//         );
//     }

//     const marketButtons = filteredMarkets.map((market, idx) =>
//         Markup.button.callback(`#${idx + 1}`, `view_markets:${market.id}`)
//     );

//     const marketButtonsLayout = layoutButtons(marketButtons);

//     const keyboard = Markup.inlineKeyboard([
//         ...marketButtonsLayout,
//         paginationButtons,
//         [
//             Markup.button.callback(
//                 "🔄 Refresh",
//                 `refresh_top_markets:${marketCategory}:${filter}:${offset}`
//             ),
//             Markup.button.callback("❌ Close", "close_message"),
//         ],
//     ]);

//     if (ctx.updateType === "callback_query") {
//         try {
//             await ctx.editMessageText(message, {
//                 parse_mode: "Markdown",
//                 reply_markup: keyboard.reply_markup,
//             });
//         } catch (error: any) {
//             if (
//                 error?.response?.error_code === 400 &&
//                 error?.response?.description?.includes("message is not modified")
//             ) {
//                 await ctx.answerCbQuery();
//             } else {
//                 console.error("❌ editMessageText Failed:", error);
//                 await ctx.answerCbQuery("⚠️ Failed to Update the Message.");
//             }
//         }

//         return;
//     }

//     return ctx.reply(message, {
//         parse_mode: "Markdown",
//         reply_markup: keyboard.reply_markup,
//     });
// }

// case "0dte":
//             params.set("end_date_min", now.toISOString());
//             params.set("end_date_max", tomorrowEnd.toISOString());
//             params.set("order", "endDate");
//             break;

export async function handleShowMarkets(ctx: Context, eventId: number) {
    const response = await axios.get(`https://gamma-api.polymarket.com/events?id=${eventId}`);
    const data = response.data[0];

    const title = data.title;
    const markets = data.markets
        .filter((m: any) => m.active && m.acceptingOrders && !m.closed)
        .map((market: any) => {
            const outcomes: number[] = JSON.parse(market.outcomePrices);
            return {
                ...market,
                yesPrice: outcomes[0],
                noPrice: outcomes[1],
                probability: Math.round(outcomes[0] * 100),
            };
        })
        .sort((a: any, b: any) => b.yesPrice - a.yesPrice);

    if (markets.length === 0) {
        return ctx.reply("❌ No Active Markets Available in This Event.");
    }

    if (markets.length === 1) {
        return handleViewMarket(ctx, markets[0].id);
    }

    let message = `📊 **${escapeMarkdown(title)}**\n\n`;

    message += `🎯 **${markets.length} Markets Available**\n\n`;

    const marketButtons = [];

    for (let i = 0; i < markets.length; i++) {
        const market = markets[i];
        const outcomes: number[] = JSON.parse(market.outcomePrices);
        const yesPrice = outcomes[0];
        const probability = Math.round(yesPrice * 100);

        message += `**${i + 1}.** ${escapeMarkdown(market.groupItemTitle)} • ${probability}%\n`;
        marketButtons.push(Markup.button.callback(`#${i + 1}`, `view_market:${market.id}`));
    }

    const marketButtonsLayout = layoutButtons(marketButtons);
    const keyboard = Markup.inlineKeyboard([
        ...marketButtonsLayout,
        [
            Markup.button.callback("🔄 Refresh", `refresh_markets:${eventId}`),
            Markup.button.callback("❌ Close", "close_message"),
        ],
    ]);

    return ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: keyboard.reply_markup,
    });
}

export async function handleViewMarket(ctx: Context, marketId: string) {
    const market = await getMarketById(marketId);

    if (!market) {
        return ctx.reply("❌ There Was an Error Fetching Market Details!");
    }

    let message = `📊 **${escapeMarkdown(market.question)}**\n\n`;

    const userId = ctx.from?.id;
    if (userId) {
        const tokenIds = JSON.parse(market.clobTokenIds);
        const orderBookData = await formatOrderBook(tokenIds, userId.toString());
        message += orderBookData;
        message += `----------------------------------\n\n`;
    }

    const outcomes: number[] = JSON.parse(market.outcomePrices);
    const yesPrice = outcomes[0];
    const noPrice = outcomes[1];

    message += `💹 **Prices**
• Yes $${yesPrice} (${Math.round(yesPrice * 100)}%)
• No $${noPrice} (${Math.round(noPrice * 100)}%)`;

    // Check if market is in watchlist
    let watchlistButton;
    if (userId) {
        const { data: user } = await db("Users")
            .select("market_watchlist")
            .eq("id", userId)
            .single();

        const isInWatchlist =
            //@ts-expect-error Some should be allowed
            user?.market_watchlist?.some(
                (item: any) => item.marketId === marketId || item.conditionId === market.conditionId
            ) || false;
        watchlistButton = isInWatchlist
            ? Markup.button.callback("💔 Remove from Watchlist", `remove_watchlist:${market.id}`)
            : Markup.button.callback("❤️ Add to My Watchlist", `add_watchlist:${market.id}`);
    } else {
        watchlistButton = Markup.button.callback(
            "❤️ Add to My Watchlist",
            `add_watchlist:${market.id}`
        );
    }

    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback("⚡ Market Yes", `market_order:${market.id}:yes`),
            Markup.button.callback("⚡ Market No", `market_order:${market.id}:no`),
        ],
        [
            Markup.button.callback("🎯 Limit Yes", `limit_order:${market.id}:yes`),
            Markup.button.callback("🎯 Limit No", `limit_order:${market.id}:no`),
        ],
        [
            Markup.button.callback(
                "🔔 Set Price Alert",
                `set_price_alert:${encodeMarketConditionId(market.conditionId)}`
            ),
        ],
        [watchlistButton],
        [Markup.button.callback("ℹ️ About this Market", `market_details:${market.id}`)],
        [
            Markup.button.callback("🔄 Refresh", `refresh_market:${market.id}`),
            Markup.button.callback("❌ Close", "close_message"),
        ],
    ]);

    return ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: keyboard.reply_markup,
    });
}

export async function handleMarketDetails(ctx: Context, marketId: string) {
    const market = await getMarketById(marketId);

    if (!market) {
        return ctx.reply("❌ There Was an Error Fetching Market Details!");
    }

    const endDate = formatDate(market.endDate);
    const volume = formatDollarVolume(market.volume1mo || 0);
    const liquidity = formatDollarVolume(market.liquidityNum || 0);

    let message = `📊 **${escapeMarkdown(market.question)}**\n\n`;

    message += `📝 ${escapeMarkdown(market.description.trim())}\n\n`;
    message += `----------------------------------\n\n`;
    message += `⏰ **Ends:** ${endDate}\n`;
    message += `💰 **Liquidity:** ${liquidity} | **Volume:** ${volume}\n\n`;

    const outcomes: number[] = JSON.parse(market.outcomePrices);
    const yesPrice = outcomes[0];
    const noPrice = outcomes[1];

    message += `----------------------------------\n\n`;
    message += `💹 **Prices**
• Yes $${yesPrice} (${Math.round(yesPrice * 100)}%)
• No $${noPrice} (${Math.round(noPrice * 100)}%)`;
    message += `\n\n[View on Polymarket](https://polymarket.com/market/${encodeURIComponent(market.slug)})`;

    // Check if market is in watchlist
    const userId = ctx.from?.id;
    let watchlistButton;
    if (userId) {
        const { data: user } = await db("Users")
            .select("market_watchlist")
            .eq("id", userId)
            .single();

        const isInWatchlist =
            //@ts-expect-error Some should be allowed
            user?.market_watchlist?.some(
                (item: any) =>
                    item.marketId === market.id || item.conditionId === market.conditionId
            ) || false;
        watchlistButton = isInWatchlist
            ? Markup.button.callback("💔 Remove from Watchlist", `remove_watchlist:${market.id}`)
            : Markup.button.callback("❤️ Add to My Watchlist", `add_watchlist:${market.id}`);
    } else {
        watchlistButton = Markup.button.callback(
            "❤️ Add to My Watchlist",
            `add_watchlist:${market.id}`
        );
    }

    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback("⚡ Market Yes", `market_order:${market.id}:yes`),
            Markup.button.callback("⚡ Market No", `market_order:${market.id}:no`),
        ],
        [
            Markup.button.callback("🎯 Limit Yes", `limit_order:${market.id}:yes`),
            Markup.button.callback("🎯 Limit No", `limit_order:${market.id}:no`),
        ],
        [
            Markup.button.callback(
                "🔔 Set Price Alert",
                `set_price_alert:${encodeMarketConditionId(market.conditionId)}`
            ),
        ],
        [watchlistButton],
        [
            Markup.button.callback(
                "🔄 Refresh",
                `refresh_market_details:${encodeMarketConditionId(market.id)}`
            ),
            Markup.button.callback("❌ Close", "close_message"),
        ],
    ]);

    return ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: keyboard.reply_markup,
        link_preview_options: { is_disabled: true },
    });
}

export async function handleDeleteUserWallet(ctx: Context, walletAddress: string) {
    const userId = getUserIdFromCtx(ctx);

    try {
        // Stop monitoring first
        await stopWalletMonitoring(walletAddress, userId);

        // Remove from watched_wallets array
        const { data: currentUser } = await db("Users")
            .select("watched_wallets")
            .eq("id", userId)
            .single();

        const currentWallets = currentUser?.watched_wallets || [];
        const updatedWallets = currentWallets.filter((w) => w !== walletAddress);

        await db("Users").update({ watched_wallets: updatedWallets }).eq("id", userId);

        // Delete from Copy_Wallets table
        const { error } = await db("Copy_Wallets")
            .delete()
            .filter("user_id", "eq", userId)
            .filter("wallet_address", "eq", walletAddress);

        if (error) throw new Error(error.message, { cause: error.cause });

        if ("answerCbQuery" in ctx) {
            await ctx.answerCbQuery("Wallet deleted");
        }
        return ctx.reply("✅ Wallet was Successfully Deleted!");
    } catch (error) {
        console.error("Error Deleting User Copy Wallet: ", error);
        if ("answerCbQuery" in ctx) {
            await ctx.answerCbQuery("Error occurred");
        }
        return ctx.reply(`❌ There was an error deleting the wallet! Please try again later.`, {
            parse_mode: "Markdown",
        });
    }
}

export async function handleWalletMonitoringMenu(ctx: Context) {
    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    const watchedWallets = ["0x56687bf447db6ffa42ffe2204a05edaa20f55839"];

    const message =
        `🔍 **Wallet Monitoring**\n\n` +
        `👁️ **Currently Watching:** ${watchedWallets.length}/3 Wallets\n\n` +
        (watchedWallets.length > 0
            ? watchedWallets
                  .map((wallet: string, index: number) => `${index + 1}. \`${wallet}\``)
                  .join("\n") + "\n\n"
            : "") +
        `Select an Action:`;

    const monitoringButtons = [
        [Markup.button.callback("➕ Start Watching Wallet", "wallet_monitor_add")],
        ...(watchedWallets.length > 0
            ? [[Markup.button.callback("🗑️ Stop Watching Wallet", "wallet_monitor_remove")]]
            : []),
        [Markup.button.callback("📊 View Status", "wallet_monitor_status")],
        [Markup.button.callback("❌ Close", "close_menu")],
    ];

    await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard(monitoringButtons).reply_markup,
    });
}

export async function handleWalletMonitoringCallbacks(ctx: Context, action: string) {
    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    switch (action) {
        case "add":
            return handleStartWalletMonitoring(ctx);
        case "remove":
            return handleStopWalletMonitoring(ctx);
        case "status":
            return handleWalletMonitoringStatus(ctx);
        default:
            return ctx.answerCbQuery("Unknown Action!");
    }
}

async function handleStartWalletMonitoring(ctx: Context) {
    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    await ctx.answerCbQuery();

    const message =
        `🔍 **Start Wallet Monitoring**\n\n` +
        `Please Enter the Wallet Address You Want to Monitor:\n\n` +
        `📌 **Example:**\n` +
        `\`0x56687bf447db6ffa42ffe2204a05edaa20f55839\`\n\n` +
        `⚠️ **Note:** You Can Monitor Up to 3 Wallets Simultaneously.`;

    await setUserInputState(userId.toString(), "walletMonitor");
    return ctx.reply(message, { parse_mode: "Markdown" });
}

async function handleStopWalletMonitoring(ctx: Context) {
    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    const watchedWallets = ["0x56687bf447db6ffa42ffe2204a05edaa20f55839"];

    if (watchedWallets.length === 0) {
        await ctx.answerCbQuery("No Wallets Being Monitored");
        return ctx.reply("⚠️ You're Not Currently Monitoring Any Wallets.");
    }

    const walletButtons = watchedWallets.map((wallet: string) => [
        Markup.button.callback(
            `🛑 ${wallet.substring(0, 10)}...${wallet.substring(wallet.length - 8)}`,
            `stop_wallet_monitor:${wallet}`
        ),
    ]);

    walletButtons.push([Markup.button.callback("❌ Cancel", "wallet_monitor")]);

    await ctx.answerCbQuery();
    return ctx.reply("🗑️ **Stop Wallet Monitoring**\n\nSelect a Wallet to Stop Monitoring:", {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard(walletButtons).reply_markup,
    });
}

async function handleWalletMonitoringStatus(ctx: Context) {
    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    const message = `📊 **Wallet Monitoring Status**\n\nFeature Coming Soon...`;

    await ctx.answerCbQuery();
    return ctx.reply(message, { parse_mode: "Markdown" });
}

export async function handleStopSpecificWalletMonitor(ctx: Context, walletAddress: string) {
    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    try {
        await ctx.answerCbQuery("Wallet Monitoring Stopped");
        return ctx.reply(
            `✅ Stopped Monitoring Wallet:\n\`${walletAddress}\`\n\n` +
                `You Will No Longer Receive Updates for This Wallet.`,
            { parse_mode: "Markdown" }
        );
    } catch (error) {
        console.error("Error Stopping Wallet Monitor:", error);
        await ctx.answerCbQuery("Error Occurred");
        return ctx.reply("❌ Failed to Stop Wallet Monitoring. Please Try Again.");
    }
}

export async function handleEnableCopyTrade(ctx: Context) {
    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    try {
        const { data: userWallets, error } = await db("Copy_Wallets")
            .select("*")
            .eq("user_id", Number(userId));

        if (error) throw error;

        if (!userWallets || userWallets.length === 0) {
            await ctx.answerCbQuery("No Wallets Added");
            return ctx.reply(
                "⚠️ **No Wallets Added**\n\n" +
                    "Please Add Wallets to Copy Trade Before Enabling Copy Trading.",
                { parse_mode: "Markdown" }
            );
        }

        const isSuccess = await manageUserCopyTrade(userId, true);

        if (!isSuccess) {
            await ctx.answerCbQuery();
            return ctx.reply("❌ Failed to Enable Copy Trade.");
        }

        await ctx.answerCbQuery("Copy Trading Enabled");
        return ctx.reply(
            `✅ **Copy Trading Enabled**\n\n` +
                `You Are Now Copy Trading From ${userWallets.length} Wallet(s):\n` +
                userWallets
                    .map((wallet, index) => `${index + 1}. (\`${wallet.wallet_address}\`)`)
                    .join("\n"),
            { parse_mode: "Markdown" }
        );
    } catch (error) {
        console.error("Error Enabling Copy Trade:", error);
        await ctx.answerCbQuery("Error Occurred");
        return ctx.reply("❌ Failed to Enable Copy Trading. Please Try Again.");
    }
}

export async function handleStopCopyTrade(ctx: Context) {
    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    try {
        const isSuccess = await manageUserCopyTrade(userId, false);

        if (!isSuccess) {
            await ctx.answerCbQuery();
            return ctx.reply("❌ Failed to Stop Copy Trade.");
        }

        await ctx.answerCbQuery("Copy Trading Stopped");
        return ctx.reply(
            "🛑 **Copy Trading Stopped**\n\n" +
                "You Are No Longer Copy Trading. Your Added Wallets Remain Saved.",
            { parse_mode: "Markdown" }
        );
    } catch (error) {
        console.error("Error Stopping Copy Trade:", error);
        await ctx.answerCbQuery("Error Occurred");
        return ctx.reply("❌ Failed to Stop Copy Trading. Please Try Again.");
    }
}

export async function handleCloseOpenPosition(
    ctx: Context,
    conditionId: string,
    amountToSell?: number
) {
    const userId = getUserIdFromCtx(ctx);
    const user = await getUserDetails(userId);

    // TODO: LET'S SEE
    // const userPhotos = await ctx.telegram.getUserProfilePhotos(userId);

    if (!user) return ctx.reply("⚠️ Internal Server Error. Please try again later.");

    const { message_id } = await ctx.reply("⌛ Closing your position...");

    const decodedConditionId = decodeMarketId(conditionId);
    const [userDataResponse, userMarketDetails, marketDetails] = await Promise.all([
        getUserByIdFromDb(userId),
        getUserPositionByMarket(user.wallet_address, decodedConditionId),
        getMarketByConditionId(decodedConditionId),
    ]);

    const { data, error } = userDataResponse;
    if (error || !data) {
        await ctx.deleteMessage(message_id);
        return ctx.reply("⚠️ Internal Server Error. Please try again later.");
    }

    if (!userMarketDetails) {
        await ctx.deleteMessage(message_id);
        return ctx.reply("⚠️ Market not found.");
    }

    let pnlType: "Positive" | "Negative" | "Neutral";

    const username = getUsernameFromCtx(ctx);
    const marketTitle = userMarketDetails.title;
    const side = userMarketDetails.outcome as "Yes" | "No";
    const volume = Math.floor(Number(marketDetails.volume)).toLocaleString("en-US");

    const closeDate = new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    });

    if (userMarketDetails.cashPnl > 0) pnlType = "Positive";
    else if (userMarketDetails.cashPnl < 0) pnlType = "Negative";
    else pnlType = "Neutral";

    const rawProfitAmount = parseFloat(Math.abs(userMarketDetails.cashPnl).toFixed(2));
    const formattedProfitAmount = rawProfitAmount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    const entryPercentage = parseFloat((userMarketDetails.avgPrice * 100).toFixed(2));
    const exitPercentage = parseFloat((userMarketDetails.curPrice * 100).toFixed(2));

    const pnlDbFetchPromise = db("Users").select("total_pnl").eq("id", userId).single();
    const pnlCardPromise = generatePnlCard(
        pnlType,
        username,
        marketTitle,
        side,
        volume,
        closeDate,
        rawProfitAmount,
        entryPercentage,
        exitPercentage,
        user.show_username_in_cards
    );

    const sellAmount = amountToSell || userMarketDetails.size;

    const sellOrder = await marketSellOrder({
        privateKey: decryptPrivateKey(data.private_key),
        creds: JSON.parse(data.api_credentials),
        tokenId: userMarketDetails.asset,
        amount: sellAmount,
        orderType: OrderType.FOK,
    });

    if (sellOrder.error) {
        await ctx.deleteMessage(message_id);
        return ctx.reply("⚠️ There was a problem closing your position.");
    }

    // Track this manual sell for copy trading system and update volume
    await trackManualTrade(userId, userMarketDetails.asset, "SELL", sellAmount);

    // Update user's total volume (sell amount * current price)
    const sellVolume = sellAmount * userMarketDetails.curPrice;
    await updateUserVolume(userId, sellVolume);

    const orderContext = await redisClient.hGetAll(`user:order_context:${userId}`);
    const { sellType, originalSize } = orderContext;

    let updatedConfig: PriceWatchConfig | null = null;

    if (sellType === "50" || sellType === "custom") {
        const remaining =
            sellType === "custom" && originalSize
                ? Number(originalSize) - (amountToSell || 0)
                : Number(orderContext.remainingSize);

        if (!isNaN(remaining) && remaining > 0) {
            const oldWatcher = await redisClient.hGet(
                `user:tp_sl_watchers:${userId}`,
                `${decodedConditionId}:${userMarketDetails.asset}`
            );

            if (oldWatcher) {
                const oldConfig = JSON.parse(oldWatcher);
                updatedConfig = { ...oldConfig, size: remaining };
            }
        }
    }

    await stopAllTpSlWatchers(userId.toString(), conditionId);

    if (updatedConfig) {
        startTpSlWatcher(
            userId.toString(),
            decodedConditionId,
            userMarketDetails.asset,
            updatedConfig
        );
    }

    await redisClient.del(`user:order_context:${userId}`);

    const [pnlCardBuffer, { data: pnlData, error: pnlDbErr }] = await Promise.all([
        pnlCardPromise,
        pnlDbFetchPromise,
    ]);

    if (pnlDbErr || !pnlData) {
        console.error("❌ Error fetching PnL data:", pnlDbErr);
        ctx.reply("❌ Error updating your PnL details");
    } else {
        await db("Users")
            .update({
                total_pnl: (pnlData?.total_pnl || 0) + userMarketDetails.cashPnl,
            })
            .eq("id", userId);
    }

    await ctx.deleteMessage(message_id);

    const shareKey = `share:${userId}:${Date.now()}`;
    await redisClient.set(
        shareKey,
        JSON.stringify({
            marketTitle,
            side,
            pnl: rawProfitAmount,
            pnlType,
            entryPrice: entryPercentage,
            exitPrice: exitPercentage,
        }),
        { EX: 3600 }
    );

    const shareButton = Markup.inlineKeyboard([
        [Markup.button.callback("🐦 Share on X", `ts:${shareKey}`)],
    ]);

    await ctx.replyWithPhoto(
        { source: pnlCardBuffer },
        {
            caption: `✅ Position closed successfully!\n\n${
                pnlType === "Positive"
                    ? "💰 Profit"
                    : pnlType === "Negative"
                      ? "📉 Loss"
                      : "➖ Break Even"
            }: $${formattedProfitAmount}`,
            parse_mode: "Markdown",
            ...shareButton,
        }
    );
}

export async function handleConfirmOrder(ctx: Context, textMsg: string) {
    const userId = getUserIdFromCtx(ctx);
    const textMsgArray = textMsg.trim().split(/\s+/);

    if (textMsgArray.length < 1 || textMsgArray.length > 2) {
        return ctx.reply("❌ Invalid input. Use: `<price> <amount>` or just `<amount>`.");
    }

    const orderContext = await redisClient.hGetAll(`user:order_context:${userId}`);
    const { marketId, side, orderType } = orderContext;

    const market = marketId.startsWith("0x")
        ? await getMarketByConditionId(marketId)
        : await getMarketById(marketId);

    const outcomes: number[] = JSON.parse(market.outcomePrices);
    const clobTokenIds = JSON.parse(market.clobTokenIds);
    const endDate = market.endDate || market.events?.[0]?.endDate;

    const user = await getUserDetails(userId);
    if (!user) {
        return ctx.reply("⚠️ Internal Server Error. Please try again later.");
    }

    let pricePerShare = side === "YES" ? outcomes[0] : outcomes[1];

    try {
        const orderBookData = await getMarketOrderBook({
            tokenId: [clobTokenIds[0], clobTokenIds[1]],
            privateKey: decryptPrivateKey(user.private_key),
            creds: JSON.parse(user.api_credentials),
        });

        const orderBook = side === "YES" ? orderBookData.yesResponse : orderBookData.noResponse;

        const topAsks = orderBook.asks.slice(0, 3);

        if (topAsks.length > 0) {
            const avgPrice =
                topAsks.reduce((sum: any, ask: any) => sum + parseFloat(ask.price), 0) /
                topAsks.length;
            pricePerShare = avgPrice;
        }
    } catch (error) {
        console.error("Error fetching orderbook, using market price:", error);
    }

    let message = "";
    let shares = 0;
    let amount = 0;
    let executionPrice = 0;

    if (orderType === "fok") {
        // Market Order
        amount = parseFloat(textMsgArray[0]);
        if (isNaN(amount) || amount <= 0) {
            return ctx.reply("❌ Invalid amount. Please enter a valid number.");
        }

        shares = amount / pricePerShare;

        message = `
📌 *${escapeMarkdown(market.question)}*

💧 *${market.groupItemTitle}* Volume: ${formatDollarVolume(market.volumeNum || 0)}
📅 Ends: ${formatDate(endDate)}

🎯 *Market Order - ${side}*
💵 *Amount:* $${amount.toFixed(2)}
📈 *Current Market Price:* $${pricePerShare.toFixed(4)} (avg. of top 3 orders)

🚀 *Will execute immediately* at market price

*Estimated Fill:*
• Shares: ${shares.toFixed(4)}
• Execution Price: $${side === "YES" ? outcomes[0] : outcomes[1]}
• Total Cost: $${amount.toFixed(2)}
• Potential Win if resolves ${side}: $${(shares * 1).toFixed(2)}

Press *Confirm* to place the order or *Cancel*.
        `;
    } else {
        // Limit Order
        if (textMsgArray.length < 2) {
            return ctx.reply("❌ Invalid input. Use format: `<price> <amount>`");
        }

        const price = parseFloat(textMsgArray[0]);
        amount = parseFloat(textMsgArray[1]);

        if (isNaN(price) || isNaN(amount) || price <= 0 || amount <= 0) {
            return ctx.reply("❌ Invalid price or amount. Please enter valid numbers.");
        }

        const isExecutableNow = pricePerShare <= price;
        shares = amount / price;
        if (shares < 5) {
            return ctx.reply("❌ Your order would result in less than 5 shares. Minimum is 5.");
        }

        executionPrice = isExecutableNow ? pricePerShare : price;

        const priceDiff = (((price - pricePerShare) / pricePerShare) * 100).toFixed(1);
        const totalPayout = shares * 1;

        message = `
📌 *${escapeMarkdown(market.question)}*

💧 *${market.groupItemTitle}* Volume: ${formatDollarVolume(market.volumeNum)}
📅 Ends: ${formatDate(endDate)}

🎯 *Limit Order - ${side} at $${price.toFixed(4)}*
💵 *Amount:* $${amount.toFixed(2)}
📈 *Current Market Price:* $${pricePerShare.toFixed(4)} (avg. of top 3 orders)

${
    isExecutableNow
        ? `🚀 Will execute immediately - Your limit ($${price.toFixed(4)}) is ${priceDiff}% above current price ($${pricePerShare.toFixed(4)})\n\n*Estimated Fill (at market price):*\n• Shares: ${shares.toFixed(4)}\n• Execution Price: $${executionPrice.toFixed(4)}\n• Total Cost: $${amount.toFixed(2)}\n• Potential Win if resolves ${side}: $${totalPayout.toFixed(2)}`
        : `⏳ Waiting to match at your limit price\n\n*Order Details:*\n• Shares: ${shares.toFixed(4)}\n• Execution Price: $${executionPrice.toFixed(4)}\n• Total Cost: $${amount.toFixed(2)}\n• Potential Win if resolves ${side}: $${totalPayout.toFixed(2)}`
}

Press *Confirm* to place the order or *Cancel*.
        `;
    }

    const reply_message = await ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback("✅ Confirm", `confirm_order:${textMsg}`)],
            [Markup.button.callback("❌ Cancel", "cancel_order")],
        ]).reply_markup,
    });

    await redisClient.hSet(`user:confirm_msg_id:${userId}`, {
        id: reply_message.message_id,
    });
}

export async function handleCancelOrderCallback(ctx: Context, orderId: string) {
    const userId = getUserIdFromCtx(ctx);
    const user = await getUserDetails(userId);

    if (!user) {
        return ctx.reply("❌ User does not exist");
    }

    const api_creds: ApiKeyCreds = JSON.parse(user.api_credentials);

    try {
        const response = await cancelOrder({
            privateKey: decryptPrivateKey(user.private_key),
            creds: api_creds,
            orderIds: [orderId],
        });

        if (response.canceled.length > 0) {
            return ctx.reply("✅ Order Successfully Cancelled!");
        } else if (response.not_canceled.length > 0) {
            return ctx.reply("✅ Order Already Cancelled!");
        }
    } catch (error) {
        console.error("Error cancelling the Order: ", error);
        return ctx.reply("❌ Order could not be Cancelled. Please try again later.");
    }
}

export async function handleRefreshMarket(ctx: Context, marketId: string) {
    await ctx.deleteMessage();
    return handleViewMarket(ctx, marketId);
}

export async function handleRefreshHourlyMarket(ctx: Context, marketId: string) {
    await ctx.deleteMessage();
    return handleViewHourlyMarket(ctx, marketId);
}

export async function handleRefreshMarketDetails(ctx: Context, marketId: string) {
    await ctx.deleteMessage();
    return handleMarketDetails(ctx, marketId);
}

export async function handleRefreshMarkets(ctx: Context, eventId: string) {
    await ctx.deleteMessage();
    return handleShowMarkets(ctx, Number(eventId));
}

export async function handleRefreshTopMarkets(
    ctx: Context,
    marketCategory: string,
    filter: string,
    offset: string
) {
    // We need to handle this as a new message, not an edit
    const LIMIT = 8;
    let message = `🔥 Top Markets for **${marketCategory.charAt(0).toUpperCase() + marketCategory.slice(1)}** — _${capitalize(filter)}_\n\n`;

    const markets = await fetchMarkets(marketCategory, filter, Number(offset) || 0);

    const filteredMarkets =
        filter === "volume" ? markets.filter((m) => m.volume24hr && m.volume24hr > 0) : markets;

    if (filteredMarkets.length === 0) {
        return ctx.reply("⚠️ No Available Markets!");
    }

    for (let i = 0; i < filteredMarkets.length; i++) {
        const market = filteredMarkets[i];
        const fDate = formatDate(market.endDate);
        const fVolumne = formatDollarVolume(market.volume1mo || 0);

        message += `${i + 1}. **${market.title}**
💧 Volume : ${fVolumne}
⏰ Ends: ${fDate}

`;
    }

    const filterButtons = MARKET_FILTERS.map((marketFilter) =>
        Markup.button.callback(
            marketFilter.split(" ")[1].toLowerCase() === filter
                ? `✅ ${marketFilter}`
                : `   ${marketFilter}`,
            `filter_top_market:${marketCategory}:${marketFilter.split(" ")[1].toLowerCase()}`
        )
    );

    const paginationButtons = [];
    const offsetNum = Number(offset) || 0;

    if (offsetNum > 0) {
        paginationButtons.push(
            Markup.button.callback(
                "⏮️ Prev",
                `filter_top_market:${marketCategory}:${filter}:${offsetNum - LIMIT}`
            )
        );
    }

    if (filteredMarkets.length === LIMIT) {
        paginationButtons.push(
            Markup.button.callback(
                "Next ⏭️",
                `filter_top_market:${marketCategory}:${filter}:${offsetNum + LIMIT}`
            )
        );
    }

    const marketButtons = filteredMarkets.map((market, idx) =>
        Markup.button.callback(`#${idx + 1}`, `view_markets:${market.id}`)
    );

    const marketButtonsLayout = layoutButtons(marketButtons);

    const keyboard = Markup.inlineKeyboard([
        filterButtons.slice(0, 3),
        filterButtons.slice(3),
        ...marketButtonsLayout,
        paginationButtons,
        [
            Markup.button.callback(
                "🔄 Refresh",
                `refresh_top_markets:${marketCategory}:${filter}:${offsetNum}`
            ),
            Markup.button.callback("❌ Close", "close_message"),
        ],
    ]);

    try {
        await ctx.editMessageText(message, {
            parse_mode: "Markdown",
            reply_markup: keyboard.reply_markup,
        });
    } catch (error) {
        if (error instanceof Error) {
            if (!error.message.startsWith("400")) {
                console.log(error);
            }
        }
    }
}

export async function handleGeneratePortfolioCard(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);
    const user = await getUserDetails(userId);

    if (!user) return;

    if (!user.wallet_address) {
        return ctx.reply("⚠️ No Associated Wallet Address Found With Your Account!");
    }

    const msg = await ctx.reply("⚡ Generating your Portfolio Card...");

    const userPositions = await getUserPosition({ user: user.wallet_address });
    const filteredUserPositions = userPositions.filter((position) => !position.redeemable);

    if (filteredUserPositions.length === 0) {
        return ctx.reply("📭 No active positions found to generate portfolio card.");
    }

    const totalInitialValue = filteredUserPositions.reduce((sum, p) => sum + p.initialValue, 0);
    const totalCurrentValue = filteredUserPositions.reduce((sum, p) => sum + p.currentValue, 0);
    const totalPnlDiff = totalCurrentValue - totalInitialValue;

    const topPositions = filteredUserPositions
        .sort((a, b) => Math.abs(b.cashPnl) - Math.abs(a.cashPnl))
        .slice(0, 5);

    const marketData = topPositions.map((position) => ({
        title: position.title,
        pnl: position.cashPnl,
    }));

    const pnlDiffSign = totalPnlDiff >= 0 ? "+" : "-";

    const cardBuffer = await generatePortfolioPositionCard(
        user.telegram_username,
        user.show_username_in_cards,
        totalInitialValue.toFixed(2),
        pnlDiffSign,
        Math.abs(totalPnlDiff).toFixed(2),
        marketData
    );

    await ctx.deleteMessage(msg.message_id);
    await ctx.replyWithPhoto(
        { source: cardBuffer },
        {
            caption: `📊 Portfolio Summary for @${user.telegram_username}`,
        }
    );
}

export async function handleShowCurrentHour0DTEMarkets(ctx: Context) {
    const LIMIT = 8;

    // Current ET hour window
    const nowET = DateTime.now().setZone("America/New_York");
    const currentHourET = nowET.startOf("hour");
    const nextHourET = currentHourET.plus({ hours: 1 });

    const currentHourLabel = currentHourET.toFormat("ha").toUpperCase();
    const currentHourETString = `${currentHourLabel} ET`;

    let message = `⏰ *Hourly (Current ${currentHourETString})*\n\n`;

    let hourlyMarkets: any[] = [];
    try {
        hourlyMarkets = await fetchHourlyMarkets(currentHourET, nextHourET);
    } catch (err) {
        console.error(err);
        return ctx.reply("⚠️ Failed to load hourly markets.");
    }

    if (hourlyMarkets.length === 0) {
        return ctx.reply(`⚠️ No Hourly Markets for ${currentHourETString}`);
    }

    for (let i = 0; i < hourlyMarkets.length && i < LIMIT; i++) {
        const market = hourlyMarkets[i];
        const endTime = DateTime.fromISO(market.endDate);
        const minutesLeft = Math.max(0, Math.floor(endTime.diffNow("minutes").minutes));
        const fVol = formatDollarVolume(market.volumeNum || 0);

        message += `${i + 1}. *${escapeMarkdown(market.question)}*
💧 Volume: ${fVol}
⌛ Time left: ${minutesLeft} minutes

`;
    }

    const marketButtons = hourlyMarkets.map((market, idx) =>
        Markup.button.callback(`#${idx + 1}`, `view_hourly_market:${market.id}`)
    );

    const marketButtonsLayout = layoutButtons(marketButtons);

    const keyboard = Markup.inlineKeyboard([
        ...marketButtonsLayout,
        [Markup.button.callback("🔄 Refresh", `current_btc_hourly_markets`)],
        [Markup.button.callback("❌ Close", "close_message")],
    ]);

    if (
        "callbackQuery" in ctx &&
        (ctx.callbackQuery as any).data === "current_btc_hourly_markets"
    ) {
        return ctx
            .editMessageText(message, {
                parse_mode: "Markdown",
                reply_markup: keyboard.reply_markup,
            })
            .catch(() => {});
    }

    return ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: keyboard.reply_markup,
    });
}

async function fetchHourlyMarkets(currentHourET: DateTime, nextHourET: DateTime) {
    const cacheKey = `hourly:markets:${currentHourET.toISO()}`;

    // Try Redis cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }

    // Otherwise fetch from Polymarket API
    const url = new URL("https://gamma-api.polymarket.com/markets");
    url.searchParams.set("tag_id", "102175");
    url.searchParams.set("active", "true");
    url.searchParams.set("closed", "false");
    url.searchParams.set("archived", "false");
    url.searchParams.set("limit", "200");

    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch hourly markets: ${await res.text()}`);
    }

    const markets: any[] = await res.json();

    // Filter markets in current hour
    const hourlyMarkets = markets.filter((m) => {
        if (!m.eventStartTime) return false;
        const evTime = DateTime.fromISO(m.eventStartTime);
        return evTime >= currentHourET.toUTC() && evTime < nextHourET.toUTC();
    });

    // Cache until the end of this hour
    const ttlSeconds = Math.floor(nextHourET.diffNow("seconds").seconds);
    if (hourlyMarkets.length > 0) {
        await redisClient.setEx(cacheKey, ttlSeconds, JSON.stringify(hourlyMarkets));
    }

    return hourlyMarkets;
}

export async function handleViewHourlyMarket(ctx: Context, marketId: string) {
    const userId = getUserIdFromCtx(ctx);
    const market = await getMarketById(marketId);

    if (!market) {
        return ctx.reply("❌ There Was an Error Fetching Market Details!");
    }

    let message = `📊 **${escapeMarkdown(market.question)}**\n\n`;

    const tokenIds = JSON.parse(market.clobTokenIds);
    const orderBookData = await formatOrderBook(tokenIds, userId.toString());
    message += orderBookData;
    message += `----------------------------------\n\n`;

    const outcomes: number[] = JSON.parse(market.outcomePrices);
    const yesPrice = outcomes[0];
    const noPrice = outcomes[1];

    const symbol = detectSymbolFromSlug(market.slug);

    let priceInfo = "";
    if (symbol) {
        try {
            // 🔹 Price to Beat (hourly open)
            const tokenPriceAtStart = await getTokenPriceAtMarketStart(
                symbol,
                market.eventStartTime
            );

            // 🔹 Current Live Price (cached 1 min)
            const currentPrice = await getCurrentTokenPrice(symbol);

            priceInfo =
                `💰 Price to Beat: $${tokenPriceAtStart.toLocaleString()}\n` +
                `📈 Current Price: $${currentPrice.toLocaleString()}\n`;
        } catch (err) {
            console.error(`⚠️ Failed to fetch price for ${symbol}`, err);
            priceInfo = `💰 Price to Beat: N/A\n📈 Current Price: N/A\n`;
        }
    }

    message += `💹 **Prices**
• Yes $${yesPrice} (${Math.round(yesPrice * 100)}%)
• No $${noPrice} (${Math.round(noPrice * 100)}%)`;

    message += `\n\n----------------------------------\n\n`;

    message += priceInfo;

    let watchlistButton;
    if (userId) {
        const { data: user } = await db("Users")
            .select("market_watchlist")
            .eq("id", userId)
            .single();

        const isInWatchlist =
            //@ts-expect-error Some should be allowed
            user?.market_watchlist?.some(
                (item: any) => item.marketId === marketId || item.conditionId === market.conditionId
            ) || false;
        watchlistButton = isInWatchlist
            ? Markup.button.callback("💔 Remove from Watchlist", `remove_watchlist:${market.id}`)
            : Markup.button.callback("❤️ Add to My Watchlist", `add_watchlist:${market.id}`);
    } else {
        watchlistButton = Markup.button.callback(
            "❤️ Add to My Watchlist",
            `add_watchlist:${market.id}`
        );
    }

    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback("⚡ Market Yes", `market_order:${market.id}:yes`),
            Markup.button.callback("⚡ Market No", `market_order:${market.id}:no`),
        ],
        [
            Markup.button.callback("🎯 Limit Yes", `limit_order:${market.id}:yes`),
            Markup.button.callback("🎯 Limit No", `limit_order:${market.id}:no`),
        ],
        [
            Markup.button.callback(
                "🔔 Set Price Alert",
                `set_price_alert:${encodeMarketConditionId(market.conditionId)}`
            ),
        ],
        [watchlistButton],
        [Markup.button.callback("ℹ️ About this Market", `market_details:${market.id}`)],
        [
            Markup.button.callback("🔄 Refresh", `refresh_hourly_market:${market.id}`),
            Markup.button.callback("❌ Close", "close_message"),
        ],
    ]);

    return ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: keyboard.reply_markup,
    });
}

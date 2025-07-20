import { TRADE_MENU_BUTTONS } from "@/bot/ui/buttons";
import {
    manageUserCopyTrade,
    escapeMarkdown,
    formatCurrentTradePositionsMessage,
    formatDate,
    formatDollarVolume,
    getUserByIdFromDb,
    getUserIdFromCtx,
    layoutButtons,
    padButtonText,
    formatOrderBook,
    formatSinglePositionMessage,
} from "@/bot/utils";
import { getUserAddressFromId } from "@/helpers/get-user-address-from-id";
import { getUserDetails } from "@/helpers/get-user-details";
import { redisClient } from "@/lib/redis";
import { CATEGORY_LIST, MARKET_FILTERS } from "@/shared/constants";
import { capitalize } from "@/utils/capitalize";
import {
    fetchMarkets,
    getMarketByConditionId,
    getMarketById,
} from "@/utils/polymarket/get-markets";
import { getUserPosition, getUserPositionByMarket } from "@/utils/polymarket/get-user-position";
import { Markup, type Context } from "telegraf";
import type { InlineKeyboardButton } from "telegraf/types";
import axios from "axios";
import { db } from "@/lib/supabase";
import { generateClosePositionButton } from "@/bot/ui/buttons/trade";
import { marketSellOrder } from "@/utils/polymarket-order/market-buy-order";
import { OrderType } from "@polymarket/clob-client";
import { decodeMarketId, encodeMarketId } from "@/utils/encoding";
import { decryptPrivateKey } from "@/utils/crypto";
import { cancelOrder } from "@/utils/polymarket-order/cancel-order";
import type { ApiKeyCreds } from "@/types/polymarket";
import { setUserInputState } from "@/bot/input/state";

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
        return ctx.reply("⚠️ No Open Positions From Your Account.").then(() => ctx.answerCbQuery());
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
                generateClosePositionButton(encodeMarketId(data.marketId)),
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

    if (userPositions.length === 0) {
        return ctx.reply("⚠️ No Open Positions From Your Account.").then(() => ctx.answerCbQuery());
    }

    const { text, markup } = formatSinglePositionMessage(userPositions[0], 0, userPositions.length);

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

    const pageIndex = parseInt(page);
    const position = userPositions[pageIndex];

    if (!position) return ctx.answerCbQuery("Page not found");

    const { text, markup } = formatSinglePositionMessage(position, pageIndex, userPositions.length);

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

export async function handleFetchMarketWithOffsetCallback(
    ctx: Context,
    queryText: string,
    action: "next" | "prev",
    offset: number
) {
    const newOffset = action === "next" ? offset + 5 : offset - 5;

    const response = await fetch(
        `https://gamma-api.polymarket.com/events?tag_slug=${queryText}&limit=5&offset=${newOffset}&closed=false`
    );
    const marketData = await response.json();

    if (marketData.length == 0) {
        return ctx.reply("⚠️ There Are No More Markets!");
    }

    const marketTitleButtons: InlineKeyboardButton[][] = [];

    for (const market of marketData) {
        marketTitleButtons.push([
            Markup.button.callback(padButtonText(market.title), `selected_market:${market.id}`),
        ]);
    }

    const offsetButtons: InlineKeyboardButton[] = [];

    if (newOffset >= 5) {
        offsetButtons.push(
            Markup.button.callback("⏮️ Prev", `fetch_markets:${queryText}:prev:${offset - 5}`)
        );
    }

    offsetButtons.push(
        Markup.button.callback("Next ⏭️", `fetch_markets:${queryText}:next:${offset + 5}`)
    );

    marketTitleButtons.push(offsetButtons);

    await ctx.editMessageText("Markets: ", {
        reply_markup: Markup.inlineKeyboard(marketTitleButtons).reply_markup,
    });

    await ctx.answerCbQuery();
}

export async function handleViewTopMarketsByCategory(
    ctx: Context,
    marketCategory: string,
    filter: string = "volume",
    offset: number = 0
) {
    const LIMIT = 8;
    let message = `🔥 Top Markets for **${marketCategory.charAt(0).toUpperCase() + marketCategory.slice(1)}** — _${capitalize(filter)}_\n\n`;

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

        message += `${i + 1}. **${market.title}**
📊 Volume : ${fVolumne}
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
        [Markup.button.callback("❌ Close", "close_message")],
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

    let message = `📊 **${escapeMarkdown(title)}**\n\n`;

    if (markets.length === 1) {
        const market = markets[0];
        const outcomes: number[] = JSON.parse(market.outcomePrices);
        const yesPrice = outcomes[0];
        const noPrice = outcomes[1];

        const userId = ctx.from?.id?.toString();
        if (userId) {
            const tokenIds = JSON.parse(market.clobTokenIds);
            const orderBookData = await formatOrderBook(tokenIds, userId);
            message += orderBookData;
            message += `----------------------------------\n\n`;
        }

        message += `💹 **Prices:** Yes $${yesPrice} (${Math.round(yesPrice * 100)}%) • No $${noPrice} (${Math.round(noPrice * 100)}%)\n\n`;
        const keyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback("⚡ Market Yes", `market_order:${market.id}:yes`),
                Markup.button.callback("⚡ Market No", `market_order:${market.id}:no`),
            ],
            [
                Markup.button.callback("🎯 Limit Yes", `limit_order:${market.id}:yes`),
                Markup.button.callback("🎯 Limit No", `limit_order:${market.id}:no`),
            ],
            [Markup.button.callback("💵 Sell Position", `sell_position:${market.id}`)],
            [Markup.button.callback("ℹ️ About this Market", `market_details:${market.id}`)],
            [Markup.button.callback("❌ Close", "close_message")],
        ]);

        return ctx.reply(message, {
            parse_mode: "Markdown",
            reply_markup: keyboard.reply_markup,
        });
    }

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
        [Markup.button.callback("❌ Close", "close_message")],
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

    const userId = ctx.from?.id?.toString();
    if (userId) {
        const tokenIds = JSON.parse(market.clobTokenIds);
        const orderBookData = await formatOrderBook(tokenIds, userId);
        message += orderBookData;
        message += `----------------------------------\n\n`;
    }

    const outcomes: number[] = JSON.parse(market.outcomePrices);
    const yesPrice = outcomes[0];
    const noPrice = outcomes[1];

    message += `💹 **Prices:** Yes $${yesPrice} (${Math.round(yesPrice * 100)}%) • No $${noPrice} (${Math.round(noPrice * 100)}%)\n\n`;

    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback("⚡ Market Yes", `market_order:${market.id}:yes`),
            Markup.button.callback("⚡ Market No", `market_order:${market.id}:no`),
        ],
        [
            Markup.button.callback("🎯 Limit Yes", `limit_order:${market.id}:yes`),
            Markup.button.callback("🎯 Limit No", `limit_order:${market.id}:no`),
        ],
        [Markup.button.callback("💵 Sell Position", `sell_position:${market.id}`)],
        [Markup.button.callback("ℹ️ About this Market", `market_details:${market.id}`)],
        [Markup.button.callback("❌ Close", "close_message")],
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
    const spread = market.spread ? (market.spread * 100).toFixed(2) : "N/A";
    const minOrderSize = market.orderMinSize || 0;
    const minOrderValue = (minOrderSize * Math.min(yesPrice, noPrice)).toFixed(2);

    message += `----------------------------------\n\n`;
    message += `💹 **Prices:** Yes $${yesPrice} (${Math.round(yesPrice * 100)}%) • No $${noPrice} (${Math.round(noPrice * 100)}%)\n`;
    message += `📊 **Spread:** ${spread}% • **Min Order:** ${minOrderSize} shares (~$${minOrderValue})\n`;

    if (market.lastTradePrice) {
        message += `🔄 **Last Trade:** $${market.lastTradePrice}\n`;
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
        [Markup.button.callback("💵 Sell Position", `sell_position:${market.id}`)],
        [Markup.button.callback("❌ Close", "close_message")],
    ]);

    return ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: keyboard.reply_markup,
    });
}

export async function handleDeleteUserWallet(ctx: Context, walletAddress: string) {
    const userId = getUserIdFromCtx(ctx);

    try {
        const { error } = await db("Copy_Wallets")
            .delete()
            .filter("user_id", "eq", userId)
            .filter("wallet_address", "eq", walletAddress);

        if (error) throw new Error(error.message, { cause: error.cause });

        ctx.reply("✅ Wallet Was Successfully Deleted!");
    } catch (error) {
        console.error("Error Deleting User Copy Wallet: ", error);
        return ctx.reply(`❌ There Was an Error Deleting Copy Wallet! Please Try Again Later.`, {
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
    if (!user) {
        return ctx.reply("⚠️ Internal Server Error. Please try again later.");
    }

    const { message_id } = await ctx.reply("⌛ Closing your position...");

    const decodedConditionId = decodeMarketId(conditionId);

    const [userDataResponse, marketDetails] = await Promise.all([
        getUserByIdFromDb(userId),
        getUserPositionByMarket(user.wallet_address, decodedConditionId),
    ]);

    const { data, error } = userDataResponse;

    if (error || !data) {
        ctx.deleteMessage(message_id);
        return ctx.reply("⚠️ Internal Server Error. Please try again later.");
    }

    if (!marketDetails) {
        ctx.deleteMessage(message_id);
        return ctx.reply("⚠️ Market not found.");
    }

    const { error: sellError } = await marketSellOrder({
        privateKey: decryptPrivateKey(data.private_key),
        creds: JSON.parse(data.api_credentials),
        tokenId: marketDetails.asset,
        amount: amountToSell || marketDetails.size,
        orderType: OrderType.FOK,
    });

    if (sellError) {
        await ctx.deleteMessage(message_id);
        return ctx.reply("⚠️ There was a problem closing your position.");
    }

    const { data: pnlData, error: userDataError } = await db("Users")
        .select("total_pnl")
        .eq("id", userId)
        .single();

    if (userDataError || !pnlData) {
        ctx.reply("❌ Error updating your PnL details");
    }

    await db("Users")
        .update({ total_pnl: pnlData?.total_pnl || 0 + marketDetails.cashPnl })
        .eq("id", userId);

    await ctx.deleteMessage(message_id);
    ctx.reply("✅ Your position was closed successfully!");
}

export async function handleConfirmOrder(ctx: Context, textMsg: string) {
    const userId = getUserIdFromCtx(ctx);
    const textMsgArray = textMsg.split(" ");

    const orderContext = await redisClient.hGetAll(`user:order_context:${userId}`);
    const { marketId, side } = orderContext;

    const market = await getMarketById(marketId);

    let price = null;
    let size = null;

    price = Number(textMsgArray[0]);
    if (textMsgArray.length === 2) {
        size = textMsgArray[1];
    }

    const outcomes: number[] = JSON.parse(market.outcomePrices);
    const pricePerShare = side === "YES" ? outcomes[0] : outcomes[1];
    const endDate = market.endDate || market.events?.[0]?.endDate;

    let shares: number;
    let potentialProfit: number;

    if (size) {
        shares = Number(size);
        potentialProfit = shares * (1 - price);
    } else {
        shares = price / pricePerShare;
        potentialProfit = shares * (1 - pricePerShare);
    }

    const message = `
📌 *${escapeMarkdown(market.question)}*
📅 Ends: ${formatDate(endDate)}
🔷 *${market.groupItemTitle}* Volume: ${formatDollarVolume(market.volumeNum)}

🔷 Buying *${side}* with *$${price}*

• Shares: ${size || Math.floor(shares)}
• Price: ${side === "YES" ? outcomes[0] : outcomes[1]}
• Potential Profit: $${potentialProfit.toFixed(2)}

Tap *Confirm* to place the order.
`;

    return ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback("✅ Confirm", `confirm_order:${textMsg}`)],
            [Markup.button.callback("❌ Cancel", "cancel_order")],
        ]).reply_markup,
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

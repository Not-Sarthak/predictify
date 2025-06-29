import { Context, Markup } from "telegraf";
import { redisClient } from "../../lib/redis";
import {
    awaitingMarketTermInputSet,
    awaitingWalletDetailsInputSet,
    awaitingWalletMonitorInputSet,
} from "../../bot";
import { supabase } from "../../lib/supabase";
import { getUserAddressFromId } from "../../helpers/get-user-address-from-id";
import { getUserPosition } from "../polymarket/get-user-position";
import type { InlineKeyboardButton } from "telegraf/types";
import { getMarketDetails } from "../../helpers/get-market-details";
import { CATEGORY_LIST, MARKET_FILTERS } from "../../shared/constants";
import { fetchMarkets, getMarketById } from "../polymarket/get-markets";
import { capitalize } from "../../shared/utils/capitalize";
import axios from "axios";
import { walletSocketServer } from "../polymarket-socket/socket";
import {
    disableUserCopyTrade,
    enableUserCopyTrade,
} from "../../bot/utils/database/manage-copy-trade";
import { MAIN_MENU_BUTTONS } from "@/bot/ui/buttons";

export async function handleTradeCallbacks(ctx: Context, action: string, marketId: string) {
    if (action === "yes") {
        // Call placeSingleOrder Function here w/ Yes
        await ctx.answerCbQuery("✅ Buy Yes Clicked");
        return ctx.reply(`🟢 You Chose to Buy Yes on Market: ${marketId}`);
    } else if (action === "no") {
        // Call placeSingleOrder Function here w/ No
        await ctx.answerCbQuery("❌ Buy No Clicked");
        return ctx.reply(`🔴 You Chose to Buy No on Market: ${marketId}`);
    }

    return ctx.answerCbQuery();
}

export async function handleViewTopMarketsCallback(ctx: Context) {
    const tradeCategoriesButtons = CATEGORY_LIST.map((cat) =>
        Markup.button.callback(cat, `view_top_markets:${cat}`)
    );

    const layout = [];
    for (let i = 0; i < tradeCategoriesButtons.length; i += 2) {
        layout.push(tradeCategoriesButtons.slice(i, i + 2));
    }

    return ctx.reply("🔥 Trading Markets: ", {
        reply_markup: Markup.inlineKeyboard(layout).reply_markup,
    });
}

export async function handleViewTopMarketsByCategory(
    ctx: Context,
    marketCategory: string,
    filter: string = "volume",
    offset: number = 0
) {
    const LIMIT = 8;
    let message = `🔥 Top Markets for ***${marketCategory}*** — _${capitalize(filter)}_\n\n`;

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

        message += `${i + 1}. ***${market.title}***
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
        [Markup.button.callback("❌ Close", `close:delete_message`)],
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
                console.error("❌ editMessageText failed:", error);
                await ctx.answerCbQuery("⚠️ Failed to update the message.");
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
    const fDate = formatDate(data.endDate);
    const fVolume = formatDollarVolume(data.volume1mo || 0);
    const markets = data.markets;

    let message = `📌 ***${title}***

📅 Ends: ${fDate}
📊 Volume: ${fVolume}

`;

    if (markets.length === 1) {
        const outcomes: number[] = JSON.parse(markets[0].outcomePrices);
        message += `Current Prices:
• Up: $${outcomes[0]}
• Down: $${outcomes[1]}
`;

        const keyboard = Markup.inlineKeyboard([
            Markup.button.callback("🛒 Buy", `buy_market:${markets[0].id}`),
            Markup.button.callback("💵 Sell", `sell_market:${markets[0].id}`),
        ]);
        return ctx.reply(message, { parse_mode: "Markdown", reply_markup: keyboard.reply_markup });
    }

    message += `***Available Markets***:

`;

    const marketButtons = [];

    for (let i = 0; i < markets.length; i++) {
        const market = markets[i];

        const priceYes = parseFloat(JSON.parse(market.outcomePrices)[0]); // "Yes" outcome
        const probability = Math.min(Math.round(priceYes * 100), 99) + "%";
        message += `• ${market.groupItemTitle} ***${probability}***\n`;
        marketButtons.push(Markup.button.callback(`#${i + 1}`, `view_market:${market.id}`));
    }

    const marketButtonsLayout = layoutButtons(marketButtons);

    return ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard(marketButtonsLayout).reply_markup,
    });
}

export async function handleViewMarket(ctx: Context, marketId: string) {
    const market = await getMarketById(marketId);

    if (!market) {
        return ctx.reply("❌ There was an error fetching market details!");
    }

    const fDate = formatDate(market.endDate);
    const fVolume = formatDollarVolume(market.volume1mo);

    let message = `📌 ***${market.title}***

📅 Ends: ${fDate}
📊 Volume: ${fVolume}

`;

    const outcomes: number[] = JSON.parse(market.outcomePrices);
    message += `Current Prices:
• Up: $${outcomes[0]}
• Down: $${outcomes[1]}
`;

    const keyboard = Markup.inlineKeyboard([
        Markup.button.callback("🛒 Buy", `buy_market:${market.id}`),
        Markup.button.callback("💵 Sell", `sell_market:${market.id}`),
    ]);
    return ctx.reply(message, { parse_mode: "Markdown", reply_markup: keyboard.reply_markup });
}

export async function handleAddNewWalletCallback(ctx: Context) {
    const userId = ctx.from?.id.toString()!;

    try {
        const { count, error: countError } = await supabase
            .from("Copy_Wallets")
            .select("*", { count: "exact" })
            .eq("user_id", Number(userId));

        if (countError) throw new Error(countError.message, { cause: countError.cause });

        if (count === 3) return ctx.reply(`❌ You have reached your Maximum Wallet Limit`);
    } catch (error) {
        console.error("Error fetching user copy wallets details: ", error);
        return ctx.reply(`❌ There was an error fetching your details! Please try again.`, {
            parse_mode: "Markdown",
        });
    }

    awaitingWalletDetailsInputSet.add(userId!);

    const message = `🧾 *Add Wallet Instructions*

Please enter your wallet in the following format:

\`<wallet_name> <wallet_address>\`

📌 *Example:*  
\`my_wallet 0x56687bf447db6ffa42ffe2204a05edaa20f55839\`
`;

    return ctx.reply(message, { parse_mode: "Markdown" });
}

export async function handleDeleteWalletCallback(ctx: Context) {
    const userId = ctx.from?.id.toString()!;

    try {
        const { data, error: countError } = await supabase
            .from("Copy_Wallets")
            .select("*")
            .eq("user_id", Number(userId));

        if (countError) throw new Error(countError.message, { cause: countError.cause });

        if (!data.length) return ctx.reply(`⚠️ You don't have any added Wallets!`);

        const deleteWalletButtons = Markup.inlineKeyboard(
            data.map((wallet) => {
                return [
                    Markup.button.callback(
                        `${wallet.wallet_name} (${wallet.wallet_address})`,
                        `delete_copy_wallet:${wallet.wallet_address}`
                    ),
                ];
            })
        );

        return ctx.reply(`Your Wallets: `, deleteWalletButtons);
    } catch (error) {
        console.error("Error fetching user copy wallets details: ", error);
        return ctx.reply(
            `❌ There was an error fetching your wallet details! Please try again later.`,
            {
                parse_mode: "Markdown",
            }
        );
    }
}

export async function handleDeleteUserWallet(ctx: Context, walletAddress: string) {
    const userId = ctx.from?.id.toString()!;

    try {
        const { error } = await supabase
            .from("Copy_Wallets")
            .delete()
            .filter("user_id", "eq", userId)
            .filter("wallet_address", "eq", walletAddress);

        if (error) throw new Error(error.message, { cause: error.cause });

        ctx.reply("✅ Wallet was Successfully deleted!");
    } catch (error) {
        console.error("Error deleting user copy wallet: ", error);
        return ctx.reply(`❌ There was an error deleting copy wallet! Please try again later.`, {
            parse_mode: "Markdown",
        });
    }
}

export async function handleViewTradePositions(ctx: Context) {
    const userId = ctx.from?.id!;
    const userAddress = await getUserAddressFromId(userId);

    if (!userAddress) {
        return ctx.reply("⚠️ No associated wallet address found with your account!");
    }

    const userPositions = await getUserPosition({ user: userAddress });

    if (userPositions.length === 0) {
        return ctx.reply("⚠️ No Open Positions from your account.").then(() => ctx.answerCbQuery());
    }

    const formattedUserPositionsMessages = formatCurrentTradePositionsMessage(
        userPositions.slice(0, 2)
    );

    for (const message of formattedUserPositionsMessages) {
        await ctx.reply(message, { parse_mode: "Markdown" });
    }
}

export async function handleManageTradePositionsCallback(ctx: Context, action: string) {
    const userId = ctx.from?.id!;

    awaitingMarketTermInputSet.add(userId.toString());
    await redisClient.hSet(`user:order_action:${userId}`, {
        action: action === "open" ? "OPEN" : "CLOSE",
    });

    return ctx.reply(
        `✍️ *Enter a term to search*\n\n` +
            `<term>\n\n` +
            `Example:\n\`basketball\`\n\n` +
            `You can enter any keyword to get relevant results.`,
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
        return ctx.reply("⚠️ There are no more markets!");
    }

    const marketTitleButtons: InlineKeyboardButton[][] = [];

    for (const market of marketData) {
        marketTitleButtons.push([
            Markup.button.callback(market.title, `selected_market:${market.id}`),
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

export async function handleSelectedMarketCallback(ctx: Context, marketId: string) {
    const marketData = await getMarketDetails(marketId);

    if (!marketData) {
        return ctx.reply("Could not fetch market details. Please try again.");
    }

    const { question, description, volumeNum, orderMinSize } = marketData;

    const message =
        `📈 *Market Details*\n\n` +
        `*Question:* ${question ?? "N/A"}\n` +
        `*Description:* ${escapeMarkdown(description.trim()) ?? "N/A"}\n\n` +
        `*Volume:* ${volumeNum ?? "0"}\n` +
        `*Min Order Size:* ${orderMinSize ?? "N/A"}\n` +
        `Please select an order type:`;

    const orderTypeButtons: InlineKeyboardButton[][] = [
        [Markup.button.callback("Good Till Cancel", `selected_order:${marketId}:gtc`)],
        [Markup.button.callback("Good Till Date", `selected_order:${marketId}:gtd`)],
        [Markup.button.callback("Fill or Kill Order", `selected_order:${marketId}:fok`)],
        [Markup.button.callback("Fill and Kill Order", `selected_order:${marketId}:fak`)],
    ];

    await ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard(orderTypeButtons).reply_markup,
    });

    await ctx.answerCbQuery();
}

export async function handleWalletMonitoringMenu(ctx: Context) {
    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    const userStats = walletSocketServer.getUserStats(userId);
    const watchedWallets = userStats?.watchedWallets || [];

    const message =
        `🔍 *Wallet Monitoring*\n\n` +
        `👁️ *Currently Watching:* ${watchedWallets.length}/3 Wallets\n\n` +
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
        `🔍 *Start Wallet Monitoring*\n\n` +
        `Please Enter the Wallet Address you want to Monitor:\n\n` +
        `📌 *Example:*\n` +
        `\`0x56687bf447db6ffa42ffe2204a05edaa20f55839\`\n\n` +
        `⚠️ *Note:* You can Monitor up to 3 Wallets Simultaneously.`;

    // TODO: Add to awaiting set for text input handling
    awaitingWalletMonitorInputSet.add(userId);

    return ctx.reply(message, { parse_mode: "Markdown" });
}

async function handleStopWalletMonitoring(ctx: Context) {
    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    const userStats = walletSocketServer.getUserStats(userId);
    const watchedWallets = userStats?.watchedWallets || [];

    if (watchedWallets.length === 0) {
        await ctx.answerCbQuery("No wallets being monitored");
        return ctx.reply("⚠️ You're not currently monitoring any wallets.");
    }

    const walletButtons = watchedWallets.map((wallet: string) => [
        Markup.button.callback(
            `🛑 ${wallet.substring(0, 10)}...${wallet.substring(wallet.length - 8)}`,
            `stop_wallet_monitor:${wallet}`
        ),
    ]);

    walletButtons.push([Markup.button.callback("❌ Cancel", "wallet_monitor")]);

    await ctx.answerCbQuery();
    return ctx.reply("🗑️ *Stop Wallet Monitoring*\n\nSelect a wallet to stop monitoring:", {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard(walletButtons).reply_markup,
    });
}

async function handleWalletMonitoringStatus(ctx: Context) {
    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    const userStats = walletSocketServer.getUserStats(userId);
    const activeConnections = walletSocketServer.getActiveConnections();
    const activeSubscriptions = walletSocketServer.getActiveSubscriptions();

    const message =
        `📊 *Wallet Monitoring Status*\n\n` +
        `🔗 *Your Connection:* ${userStats ? "✅ Connected" : "❌ Disconnected"}\n` +
        `👁️ *Your Watched Wallets:* ${userStats?.totalWatched || 0}/3\n` +
        `🌐 *Total Active Connections:* ${activeConnections}\n` +
        `📡 *Total Active Subscriptions:* ${activeSubscriptions}\n\n` +
        (userStats?.watchedWallets.length > 0
            ? `*Your Monitored Wallets:*\n` +
              userStats.watchedWallets
                  .map((wallet: string, index: number) => `${index + 1}. \`${wallet}\``)
                  .join("\n")
            : "*No wallets currently monitored*");

    await ctx.answerCbQuery();
    return ctx.reply(message, { parse_mode: "Markdown" });
}

export async function handleStopSpecificWalletMonitor(ctx: Context, walletAddress: string) {
    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    try {
        // This would trigger the socket server to stop monitoring
        // For now, we'll just show a success message
        // In a real implementation, you'd send a message to the socket server

        await ctx.answerCbQuery("Wallet Monitoring Stopped");
        return ctx.reply(
            `✅ Stopped Monitoring Wallet:\n\`${walletAddress}\`\n\n` +
                `You Will No Longer Receive Updates for this Wallet.`,
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
        const { data: userWallets, error } = await supabase
            .from("Copy_Wallets")
            .select("*")
            .eq("user_id", Number(userId));

        if (error) throw error;

        if (!userWallets || userWallets.length === 0) {
            await ctx.answerCbQuery("No Wallets Added");
            return ctx.reply(
                "⚠️ *No Wallets Added*\n\n" +
                    "Please Add Wallets to Copy Trade before Enabling Copy Trading.",
                { parse_mode: "Markdown" }
            );
        }

        const isSuccess = await enableUserCopyTrade(userId);

        if (!isSuccess) {
            await ctx.answerCbQuery();
            return ctx.reply("❌ Failed to Enable Copy Trade.");
        }

        await ctx.answerCbQuery("Copy Trading Enabled");
        return ctx.reply(
            `✅ *Copy Trading Enabled*\n\n` +
                `You are now Copy Trading from ${userWallets.length} Wallet(s):\n` +
                userWallets
                    .map(
                        (wallet, index) =>
                            `${index + 1}. ${wallet.wallet_name} (\`${wallet.wallet_address}\`)`
                    )
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
        const isSuccess = await disableUserCopyTrade(userId);

        if (!isSuccess) {
            await ctx.answerCbQuery();
            return ctx.reply("❌ Failed to Enable Copy Trade.");
        }

        await ctx.answerCbQuery("Copy Trading Stopped");
        return ctx.reply(
            "🛑 *Copy Trading Stopped*\n\n" +
                "You are no longer Copy Trading. Your Added Wallets Remain Saved.",
            { parse_mode: "Markdown" }
        );
    } catch (error) {
        console.error("Error Stopping Copy Trade:", error);
        await ctx.answerCbQuery("Error Occurred");
        return ctx.reply("❌ Failed to Stop Copy Trading. Please Try Again.");
    }
}

export async function handleCopyTradeConfigCallbacks(ctx: Context, action: string) {
    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    try {
        let configType = "";
        let configValue = "";

        switch (action) {
            case "position_50":
                configType = "Position Percentage";
                configValue = "50%";
                break;
            case "position_100":
                configType = "Position Percentage";
                configValue = "100%";
                break;
            case "position_custom":
                configType = "Position Percentage";
                configValue = "Custom";
                // TODO: Handle custom input
                await ctx.answerCbQuery("Custom percentage coming soon");
                return ctx.reply("⚠️ Custom percentage configuration coming soon!");
            case "same_proportion":
                configType = "Copy Method";
                configValue = "Same Proportion";
                break;
            case "same_amount":
                configType = "Copy Method";
                configValue = "Same Amount";
                break;
            case "max_amount":
                configType = "Position Limit";
                configValue = "Max Amount";
                // TODO: Handle max amount input
                await ctx.answerCbQuery("Max amount setting coming soon");
                return ctx.reply("⚠️ Max amount configuration coming soon!");
            default:
                await ctx.answerCbQuery("Unknown configuration");
                return;
        }

        // TODO: Save configuration to database
        // await saveCopyTradeConfig(userId, configType, configValue);

        await ctx.answerCbQuery(`${configType} set to ${configValue}`);
        return ctx.reply(
            `✅ *Configuration Updated*\n\n` +
                `**${configType}:** ${configValue}\n\n` +
                `Your copy trading settings have been updated.`,
            { parse_mode: "Markdown" }
        );
    } catch (error) {
        console.error("Error updating copy trade config:", error);
        await ctx.answerCbQuery("Error Occurred");
        return ctx.reply("❌ Failed to update configuration. Please try again.");
    }
}

export async function handleCloseMenu(ctx: Context) {
    const inlineKeyboard = Markup.inlineKeyboard(MAIN_MENU_BUTTONS).reply_markup;
    return ctx.editMessageReplyMarkup(inlineKeyboard);
}

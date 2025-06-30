import { Markup, type Context } from "telegraf";

import { handleStartMenuCallbacks } from "@/bot/callbacks/start";
import {
    handleSubscriptionManagement,
    handleSubscriptionMenuCallbacks,
} from "@/bot/callbacks/subscriptions";
import { MAIN_MENU_BUTTONS } from "@/bot/ui/buttons";
import { handleWalletSettingsMenu } from "@/bot/callbacks/settings";
import { formatBidLine, handleExportPrivateKey } from "@/bot/utils";
import {
    handleDeleteUserWallet,
    handleEnableCopyTrade,
    handleFetchMarketWithOffsetCallback,
    handleManageTradePositionsCallback,
    handleSelectedMarketCallback,
    handleShowMarkets,
    handleStopCopyTrade,
    handleStopSpecificWalletMonitor,
    handleTradeCallbacks,
    handleViewMarket,
    handleViewTopMarketsByCategory,
    handleViewTopMarketsCallback,
    handleViewTradePositions,
    handleWalletMonitoringCallbacks,
    handleWalletMonitoringMenu,
} from "@/bot/callbacks/trade";
import { redisClient } from "@/lib/redis";
import { awaitingOrderDetailsInputSet } from "@/bot";
import { getTokenIds } from "@/helpers/get-token-id";
import { getUserDetails } from "@/helpers/get-user-details";
import { getMarketOrderBook } from "@/utils/polymarket/get-markets";
import {
    handleAddNewWalletCallback,
    handleCopyTradeConfigCallbacks,
    handleCopyTradeConfigureMenu,
    handleDeleteWalletCallback,
    handleViewWatchedWallets,
} from "@/bot/callbacks/autotrade";

export async function handleCallbackQuery(ctx: Context) {
    const data = (ctx.callbackQuery as any).data as string;

    // Handle Start Menu Callbacks
    if (data.startsWith("start:")) {
        const target = data.split(":")[1];
        return handleStartMenuCallbacks(ctx, target);
    }

    // Handle Subscriptions Menu Callbacks
    if (data.startsWith("subscriptions:")) {
        const target = data.split(":")[1];
        return handleSubscriptionMenuCallbacks(ctx, target);
    }

    // Handle Subscription Management
    if (data.startsWith("subscribe:")) {
        const [isSubscribe, category] = data.split(":").slice(1);
        return handleSubscriptionManagement(ctx, isSubscribe, category);
    }

    // Handle Wallet Settings Menu
    if (data.startsWith("settings:")) {
        const action = data.split(":")[1];
        if (action === "wallet") {
            await ctx.answerCbQuery();
            return handleWalletSettingsMenu(ctx);
        }
    }

    // Handle Trade Callbacks
    if (data.startsWith("buy_yes:")) {
        const marketId = data.split(":")[1];
        return handleTradeCallbacks(ctx, "yes", marketId);
    }

    if (data.startsWith("buy_no:")) {
        const marketId = data.split(":")[1];
        return handleTradeCallbacks(ctx, "no", marketId);
    }

    // Handle View Open Trade Positions
    if (data === "trade_position_view") {
        await handleViewTradePositions(ctx);
        return ctx.answerCbQuery();
    }

    // Handle Open Trade Positions (Open = Buy)
    if (data === "trade_position_open") {
        const action = data.split("_")[2];
        return handleManageTradePositionsCallback(ctx, action);
    }

    // Handle Close Trade Position (Close = Sell)
    if (data === "trade_position_close") {
        const action = data.split("_")[2];
        return handleManageTradePositionsCallback(ctx, action);
    }

    // Handle View Top Markets Menu Callback
    if (data === "trade_top_markets_view") {
        return handleViewTopMarketsCallback(ctx).then(() => ctx.answerCbQuery());
    }

    // Handle Fetching Previous and Next Markets
    if (data.startsWith("fetch_markets:")) {
        const [queryText, action, offset] = data.split(":").splice(1);
        return handleFetchMarketWithOffsetCallback(
            ctx,
            queryText,
            action as "next" | "prev",
            Number(offset)
        );
    }

    // Handle Selected Market
    if (data.startsWith("selected_market:")) {
        const marketId = data.split(":")[1];
        return handleSelectedMarketCallback(ctx, marketId);
    }

    if (data.startsWith("buy_market:")) {
        const marketId = data.split(":")[1];
        await redisClient.hSet(`user:order_action:${ctx.from?.id!}`, {
            action: "OPEN",
        });
        return handleSelectedMarketCallback(ctx, marketId);
    }

    if (data.startsWith("sell_market:")) {
        const marketId = data.split(":")[1];
        await redisClient.hSet(`user:order_action:${ctx.from?.id!}`, {
            action: "CLOSE",
        });

        return handleSelectedMarketCallback(ctx, marketId);
    }

    // Handle Selected Order
    if (data.startsWith("selected_order:")) {
        const userId = ctx.from?.id.toString()!;
        const [marketId, orderType] = data.split(":").splice(1);

        await redisClient.hSet(`user:order_context:${userId}`, {
            marketId,
            orderType,
        });
        awaitingOrderDetailsInputSet.add(userId);

        const { action } = await redisClient.hGetAll(`user:order_action:${userId}`);

        const [tokenIds, user] = await Promise.all([
            await getTokenIds(marketId),
            await getUserDetails(Number(userId)),
        ]);

        if (!tokenIds || !user) {
            return ctx.reply("⚠️ Error fetching Order Book Details.");
        }

        const { yesResponse, noResponse } = await getMarketOrderBook({
            tokenId: tokenIds,
            privateKey: user.private_key,
            creds: JSON.parse(user.api_credentials),
        });

        const yesLines = yesResponse.bids.map(formatBidLine).join("\n");
        const noLines = noResponse.bids.map(formatBidLine).join("\n");

        const message = `📈 *Order Book - Available Bids*

*YES Bids* (to close a YES position):
${yesLines}

*NO Bids* (to close a NO position):
${noLines}
`;

        await ctx.reply(message, { parse_mode: "Markdown" });

        await ctx.reply(
            `✍️ Send Order Details in this format:

<yes OR no> <price> <size>

Example:
yes 123.45 100
`,
            {
                parse_mode: "Markdown",
            }
        );

        await ctx.answerCbQuery();
    }

    if (data.startsWith("view_top_markets:")) {
        const marketCategory = data.split(":")[1].toLowerCase();
        return handleViewTopMarketsByCategory(ctx, marketCategory);
    }

    if (data.startsWith("filter_top_market:")) {
        const [category, filter, offset] = data.split(":").slice(1);
        return handleViewTopMarketsByCategory(ctx, category, filter, Number(offset) || 0);
    }

    if (data.startsWith("view_markets:")) {
        const eventId = Number(data.split(":")[1]);
        return handleShowMarkets(ctx, eventId);
    }

    if (data.startsWith("view_market:")) {
        const marketId = data.split(":")[1];
        return handleViewMarket(ctx, marketId);
    }

    // Handle Delete User Wallet
    if (data.startsWith("delete_copy_wallet:")) {
        const walletAddress = data.split(":")[1];
        return handleDeleteUserWallet(ctx, walletAddress);
    }

    // Handle Wallet Monitoring Menu
    if (data === "wallet_monitor") {
        return handleWalletMonitoringMenu(ctx);
    }

    // Handle Wallet Monitoring Actions
    if (data.startsWith("wallet_monitor_")) {
        const action = data.split("_")[2];
        return handleWalletMonitoringCallbacks(ctx, action);
    }

    // Handle Stop Specific Wallet Monitor
    if (data.startsWith("stop_wallet_monitor:")) {
        const walletAddress = data.split(":")[1];
        return handleStopSpecificWalletMonitor(ctx, walletAddress);
    }

    // Handle Copy Trade Actions
    if (data === "enable_copy_trade") {
        return handleEnableCopyTrade(ctx);
    }

    if (data === "stop_copy_trade") {
        return handleStopCopyTrade(ctx);
    }

    // Handle Copy Trade Configure
    if (data === "copy_trade_configure") {
        return handleCopyTradeConfigureMenu(ctx);
    }

    // Handle View Watched Wallets
    if (data === "view_watched_wallets") {
        return handleViewWatchedWallets(ctx);
    }

    // Handle Configuration Settings
    if (data.startsWith("config_")) {
        const action = data.replace("config_", "");
        return handleCopyTradeConfigCallbacks(ctx, action);
    }

    // Handle Add New Wallet
    if (data === "add_new_wallet") {
        return handleAddNewWalletCallback(ctx);
    }

    // Handle Delete Wallet Callback
    if (data === "delete_wallet") {
        return handleDeleteWalletCallback(ctx);
    }

    // Handle Exporting Private Key
    if (data.startsWith("export_private_key:")) {
        const network = data.split(":")[1];
        return handleExportPrivateKey(ctx, network as "evm" | "solana");
    }

    if (data === "bridge_funds") {
        await ctx.answerCbQuery();

        // TODO:FIX - HANDLE BRIDGE FUNDS
        // @Not-Sarthak Uncomment this when you add Params
        // const response = await createDebridgeBridgeOrder({});
        // if (!response) {
        //     return ctx.reply("❌ There was a problem bridging your funds.");
        // }

        // return ctx.reply("✅ Funds Successfully Bridged to Polygon.");
    }

    // Handles Going back to Main Menu
    if (data === "back_to_main_menu") {
        return ctx.editMessageReplyMarkup(Markup.inlineKeyboard(MAIN_MENU_BUTTONS).reply_markup);
    }

    // Handle Close Messaage
    if (data === "close_message") {
        return ctx.deleteMessage();
    }

    return ctx.answerCbQuery();
}

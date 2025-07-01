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
import {
    handleBridgeFunds,
    handleBridgeAmount,
    handleBridgeConfirm,
    handleBridgeStatus,
} from "../../utils/debridge/functions/bridge-handler";

export async function handleCallbackQuery(ctx: Context) {
    const data = (ctx.callbackQuery as any).data as string;

    if (data.startsWith("start:")) {
        const target = data.split(":")[1];
        return handleStartMenuCallbacks(ctx, target);
    }

    if (data.startsWith("subscriptions:")) {
        const target = data.split(":")[1];
        return handleSubscriptionMenuCallbacks(ctx, target);
    }

    if (data.startsWith("subscribe:")) {
        const [isSubscribe, category] = data.split(":").slice(1);
        return handleSubscriptionManagement(ctx, isSubscribe, category);
    }

    if (data.startsWith("settings:")) {
        const action = data.split(":")[1];
        if (action === "wallet") {
            await ctx.answerCbQuery();
            return handleWalletSettingsMenu(ctx);
        }
    }

    if (data.startsWith("buy_yes:")) {
        const marketId = data.split(":")[1];
        return handleTradeCallbacks(ctx, "yes", marketId);
    }

    if (data.startsWith("buy_no:")) {
        const marketId = data.split(":")[1];
        return handleTradeCallbacks(ctx, "no", marketId);
    }

    if (data === "trade_position_view") {
        return handleViewTradePositions(ctx);
    }

    if (data === "trade_position_open") {
        const action = data.split("_")[2];
        return handleManageTradePositionsCallback(ctx, action);
    }

    if (data === "trade_position_close") {
        const action = data.split("_")[2];
        return handleManageTradePositionsCallback(ctx, action);
    }

    if (data === "trade_top_markets_view") {
        return handleViewTopMarketsCallback(ctx).then(() => ctx.answerCbQuery());
    }

    if (data.startsWith("fetch_markets:")) {
        const [queryText, action, offset] = data.split(":").splice(1);
        return handleFetchMarketWithOffsetCallback(
            ctx,
            queryText,
            action as "next" | "prev",
            Number(offset)
        );
    }

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

    if (data.startsWith("delete_copy_wallet:")) {
        const walletAddress = data.split(":")[1];
        return handleDeleteUserWallet(ctx, walletAddress);
    }

    if (data === "wallet_monitor") {
        return handleWalletMonitoringMenu(ctx);
    }

    if (data.startsWith("wallet_monitor_")) {
        const action = data.split("_")[2];
        return handleWalletMonitoringCallbacks(ctx, action);
    }

    if (data.startsWith("stop_wallet_monitor:")) {
        const walletAddress = data.split(":")[1];
        return handleStopSpecificWalletMonitor(ctx, walletAddress);
    }

    if (data === "enable_copy_trade") {
        return handleEnableCopyTrade(ctx);
    }

    if (data === "stop_copy_trade") {
        return handleStopCopyTrade(ctx);
    }

    if (data === "copy_trade_configure") {
        return handleCopyTradeConfigureMenu(ctx);
    }

    if (data === "view_watched_wallets") {
        return handleViewWatchedWallets(ctx);
    }

    if (data.startsWith("config_")) {
        const action = data.replace("config_", "");
        return handleCopyTradeConfigCallbacks(ctx, action);
    }

    if (data === "add_new_wallet") {
        return handleAddNewWalletCallback(ctx);
    }

    if (data === "delete_wallet") {
        return handleDeleteWalletCallback(ctx);
    }

    if (data.startsWith("export_private_key:")) {
        const network = data.split(":")[1];
        return handleExportPrivateKey(ctx, network as "evm" | "solana");
    }

    if (data === "bridge_funds") {
        return handleBridgeFunds(ctx);
    }

    if (data.startsWith("bridge_amount:")) {
        const amount = data.split(":")[1];
        return handleBridgeAmount(ctx, amount);
    }

    if (data.startsWith("bridge_confirm:")) {
        const userId = data.split(":")[1];
        return handleBridgeConfirm(ctx, userId);
    }

    if (data.startsWith("bridge_status:")) {
        const userId = data.split(":")[1];
        return handleBridgeStatus(ctx, userId);
    }

    if (data === "back_to_main_menu") {
        return ctx.editMessageReplyMarkup(Markup.inlineKeyboard(MAIN_MENU_BUTTONS).reply_markup);
    }

    if (data === "close_message") {
        return ctx.deleteMessage();
    }

    return ctx.answerCbQuery();
}

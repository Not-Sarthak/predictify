import {
    handleDeleteUserWallet,
    handleEnableCopyTrade,
    handleFetchMarketWithOffsetCallback,
    handleManageTradePositionsCallback,
    handleMarketDetails,
    handleShowMarkets,
    handleStopCopyTrade,
    handleViewMarket,
    handleViewTopMarketsByCategory,
    handleViewTopMarketsCallback,
    handleWalletMonitoringCallbacks,
    handleWalletMonitoringMenu,
    handleStopSpecificWalletMonitor,
    handleCloseOpenPosition,
    handleCloseTradePositions,
    handleViewTradePositions,
    handleTradePagination,
    handleCancelOrderCallback,
    handleRefreshMarket,
    handleRefreshMarketDetails,
    handleRefreshMarkets,
    handleRefreshTopMarkets,
} from "./trade";
import { handleStartMenuCallbacks, handleViewProfileCallback } from "./start";
import { handleSubscriptionMenuCallbacks, handleSubscriptionManagement } from "./subscriptions";
import {
    handleAddNewWalletCallback,
    handleDeleteWalletCallback,
    handleViewWatchedWallets,
    handleCopyTradeConfigureMenu,
    handleCopyTradeConfigCallbacks,
} from "./autotrade";
import {
    handleResetWallet,
    handleSwapFundsCallback,
    handleSwapFundsQuoteCallback,
    handleWalletSettingsMenu,
} from "./settings";
import { handleExportPrivateKey } from "@/bot/utils/database/export-user-private-key";
import { handleWithdrawSOL, handleWithdrawUSDC } from "@/utils/withdrawal/index";
import {
    handleBridgeConfirm,
    handleBridgeFunds,
    handleBridgeStatus,
} from "@/utils/debridge/functions/bridge-handler";
import { redisClient } from "@/lib/redis";
import { MAIN_MENU_BUTTONS } from "@/bot/ui/buttons";
import { Markup, type Context } from "telegraf";
import {
    handleToggleCopyTradeStatus,
    handleToggleWalletCopyTradeStatus,
} from "@/bot/utils/database/toggle-copytrade-status";
import { formatSinglePositionMessage, getUserByIdFromDb, getUserIdFromCtx } from "@/bot/utils";
import {
    generateAutoTradeMenu,
    generateWelcomeMessage,
    handleAutoTradeMenu,
} from "@/bot/ui/messages";
import { getSOLBalance, getUserWrappedUSDCBalance } from "@/helpers/get-user-balance";
import { handleOrderDetailsTextMessage } from "@/bot/input/order-details";
import { getUserPosition, getUserPositionByMarket } from "@/utils/polymarket/get-user-position";
import { getUserAddressFromId } from "@/helpers/get-user-address-from-id";
import { decodeMarketId } from "@/utils/encoding";
import { setUserInputState } from "@/bot/input/state";
import {
    handleCancelOpenOrdersCommand,
    sendPaginatedOrder,
} from "@/bot/commands/manage-limit-orders";
import { getUserDetails } from "@/helpers/get-user-details";
import type { ApiKeyCreds } from "@/types/polymarket";
import { createLegacyWallet } from "@/utils";
import { decryptPrivateKey } from "@/utils/crypto";
import { ethers } from "ethers";
import { ClobClient } from "@polymarket/clob-client";
import { CHAIN_ID, HOST } from "@/shared/constants";
import { sendPaginatedHistory } from "@/bot/commands/history";
import { getUnmatchedOpenOrders } from "@/utils/polymarket/get-non-matched-orders";

export async function handleCallbackQuery(ctx: Context) {
    const data =
        ctx.callbackQuery && "data" in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;

    // Always answer a callback query.
    // Works for both valid and invalid incoming data.
    await ctx.answerCbQuery();

    if (!data) return;

    /**
     * Handle Callbacks based on Data Value
     */

    console.log(data);

    if (data.startsWith("start:")) {
        const target = data.split(":")[1];
        return handleStartMenuCallbacks(ctx, target);
    }

    if (data.startsWith("subscriptions:")) {
        const action = data.split(":")[1];
        return handleSubscriptionMenuCallbacks(ctx, action);
    }

    if (data.startsWith("subscribe:")) {
        const [, isSubscribe, category] = data.split(":");
        return handleSubscriptionManagement(ctx, isSubscribe, category);
    }

    if (data.startsWith("close_position:")) {
        const encodedConditioId = data.split(":")[1];
        return handleCloseOpenPosition(ctx, encodedConditioId);
    }

    if (data === "view_profile") {
        return handleViewProfileCallback(ctx);
    }

    if (data === "show_portfolio") {
        return handleViewTradePositions(ctx);
    }

    // Handle autotrade callbacks
    if (data === "add_new_wallet") {
        return handleAddNewWalletCallback(ctx);
    }

    if (data === "delete_wallet") {
        return handleDeleteWalletCallback(ctx);
    }

    if (data === "view_watched_wallets") {
        return handleViewWatchedWallets(ctx);
    }

    if (data === "copy_trade_configure") {
        return handleCopyTradeConfigureMenu(ctx);
    }

    if (data === "back_to_autotrade") {
        const menuResult = await generateAutoTradeMenu(ctx);
        if (!menuResult) return;

        const { message, replyMarkup } = menuResult;

        await ctx.editMessageText(message, {
            parse_mode: "Markdown",
            reply_markup: replyMarkup,
        });
    }

    // Handle copy trade config callbacks
    if (data.startsWith("config_")) {
        const action = data.replace("config_", "");
        return handleCopyTradeConfigCallbacks(ctx, action);
    }

    // Handle settings callbacks
    if (data.startsWith("settings:")) {
        const action = data.split(":")[1];
        if (action === "wallet") {
            return handleWalletSettingsMenu(ctx);
        }
    }

    if (data.startsWith("export_private_key:")) {
        const network = data.split(":")[1] as "evm" | "solana";
        return handleExportPrivateKey(ctx, network);
    }

    if (data === "bridge_funds") {
        return handleBridgeFunds(ctx);
    }

    if (data.startsWith("bridge_confirm:")) {
        const userId = data.split(":")[1];
        return handleBridgeConfirm(ctx, userId);
    }

    if (data === "withdraw_sol") {
        return handleWithdrawSOL(ctx);
    }

    if (data === "withdraw_usdc") {
        return handleWithdrawUSDC(ctx);
    }

    if (data.startsWith("bridge_status:")) {
        const userId = data.split(":")[1];
        return handleBridgeStatus(ctx, userId);
    }

    if (data === "swap_funds") {
        return handleSwapFundsQuoteCallback(ctx);
    }

    if (data === "execute_swap") {
        return handleSwapFundsCallback(ctx);
    }

    if (data === "reset_wallet") {
        return handleResetWallet(ctx);
    }

    if (data.startsWith("selected_market:")) {
        const marketId = data.split(":")[1];
        return handleViewMarket(ctx, marketId);
    }

    if (data === "trade_position_view") {
        return handleViewTradePositions(ctx);
    }

    if (data.startsWith("portfolio_page")) {
        const page = data.split(":")[1];
        return handleTradePagination(ctx, page);
    }

    if (data === "trade_position_open") {
        return handleManageTradePositionsCallback(ctx, "open");
    }

    if (data === "trade_position_close") {
        return handleCloseTradePositions(ctx);
    }

    if (data.startsWith("trade_position_")) {
        const action = data.split("_")[2];
        return handleManageTradePositionsCallback(ctx, action);
    }

    if (data === "trade_top_markets_view") {
        return handleViewTopMarketsCallback(ctx);
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

    if (data.startsWith("market_details:")) {
        const marketId = data.split(":")[1];
        return handleMarketDetails(ctx, marketId);
    }

    if (data.startsWith("confirm_order:")) {
        const textMessage = data.split(":")[1];
        return handleOrderDetailsTextMessage(ctx, textMessage);
    }

    // TODO:FIX - Clear User Data from Redis
    if (data === "cancel_order") {
        await ctx.deleteMessage();
        return ctx.reply("✅ Order Cancelled!");
    }

    if (data.startsWith("limit_order:")) {
        const [marketId, side] = data.split(":").slice(1);
        const userId = getUserIdFromCtx(ctx);

        await redisClient.hSet(`user:order_context:${userId}`, {
            marketId,
            orderType: "gtc",
            side: side.toUpperCase(),
        });

        await setUserInputState(userId.toString(), "orderDetails");
        return ctx.reply(
            `🎯 **Limit Order - ${side.toUpperCase()}**\n\n` +
                `Enter Your Order Details:\n\n` +
                `**Format:** \`<price> <amount>\`\n` +
                `**Example:** \`0.65 100\`\n\n` +
                `• **Price:** The Limit Price You Want to Pay\n` +
                `• **Amount:** The USD amount you want to spend at this limit price\n` +
                `Note: Amount / Price should be minimum 10`,
            { parse_mode: "Markdown" }
        );
    }

    if (data.startsWith("market_order:")) {
        const [marketId, side] = data.split(":").slice(1);
        const userId = getUserIdFromCtx(ctx);

        await redisClient.hSet(`user:order_context:${userId}`, {
            marketId,
            orderType: "fok",
            side: side.toUpperCase(),
        });

        await setUserInputState(userId.toString(), "orderDetails");
        return ctx.reply(
            `⚡ **Market Order - ${side.toUpperCase()}**\n\n` +
                `Enter The Amount in USDC You Want to Spend:\n\n` +
                `**Format:** \`<amount>\`\n` +
                `**Example:** \`50\`\n\n` +
                `Note: Minimum Amount should be 10`,
            { parse_mode: "Markdown" }
        );
    }

    if (data.startsWith("edit_order:")) {
        const encodedOrderId = data.split(":")[1];
        const orderId = decodeMarketId(encodedOrderId);

        const userId = getUserIdFromCtx(ctx);
        const user = await getUserDetails(userId);
        if (!user) return;

        const creds: ApiKeyCreds = JSON.parse(user.api_credentials) as ApiKeyCreds;

        const legacyWallet = createLegacyWallet(
            new ethers.Wallet(decryptPrivateKey(user.private_key))
        );

        const clobClient = new ClobClient(HOST, CHAIN_ID, legacyWallet as any, creds);
        const order = await clobClient.getOrder(orderId);

        await redisClient.hSet(`user:order_context:${userId}`, {
            marketId: order.market,
            orderType: "gtc",
            side: order.side.toUpperCase(),
            cancel: "true",
            orderId: orderId,
        });

        await setUserInputState(userId.toString(), "orderDetails");
        return ctx.reply(
            `🎯 **Limit Order - ${order.side.toUpperCase()}**\n\n` +
                `Enter Your Order Details:\n\n` +
                `**Format:** \`<price> <amount>\`\n` +
                `**Example:** \`0.65 100\`\n\n` +
                `• **Price:** The Limit Price You Want to Pay\n` +
                `• **Amount:** The USD amount you want to spend at this limit price\n` +
                `Note: Amount / Price should be minimum 10`,
            { parse_mode: "Markdown" }
        );
    }

    if (data.startsWith("sell_position:")) {
        const marketId = data.split(":")[1];
        const userId = getUserIdFromCtx(ctx);

        await redisClient.hSet(`user:order_context:${userId}`, {
            marketId,
            orderType: "fok_sell",
            side: "SELL",
        });

        await setUserInputState(userId.toString(), "orderDetails");
        return ctx.reply(
            `💵 **Sell Position**\n\n` +
                `Enter The Amount in USDC You Want to Sell:\n\n` +
                `**Format:** \`<amount>\`\n` +
                `**Example:** \`25\`\n\n`,
            { parse_mode: "Markdown" }
        );
    }

    // Handle sell percentage callbacks
    if (
        data.startsWith("sell_50_") ||
        data.startsWith("sell_100_") ||
        data.startsWith("sell_custom_")
    ) {
        const parts = data.split("_");
        const sellType = parts[1]; // "50", "100", or "custom"
        const conditionId = parts.slice(2).join("_"); // Handle encoded market IDs
        const decodedConditionId = decodeMarketId(conditionId);

        const userId = getUserIdFromCtx(ctx);
        const userAddress = await getUserAddressFromId(userId);

        if (!userAddress) {
            await ctx.answerCbQuery("❌ User wallet not found");
            return ctx.reply("❌ Unable to find your wallet. Please contact support.");
        }

        const position = await getUserPositionByMarket(userAddress, decodedConditionId);

        if (!position || position.size <= 0) {
            await ctx.answerCbQuery("❌ No position found");
            return ctx.reply("❌ You don't have any shares in this market to sell.");
        }

        // Calculate amount based on sell type
        let amountToSell: number;

        if (sellType === "50") {
            amountToSell = Math.floor(position.size * 0.5);
        } else if (sellType === "100") {
            amountToSell = position.size;
        } else if (sellType === "custom") {
            await redisClient.hSet(`user:order_context:${userId}`, {
                marketId: conditionId,
            });

            await setUserInputState(userId.toString(), "close_position");
            return ctx.reply(
                `💵 **Sell Custom Amount**\n\n` +
                    `You currently have **${position.size}** shares.\n\n` +
                    `Enter the number of shares you want to sell:\n\n` +
                    `**Format:** \`<shares>\`\n` +
                    `**Example:** \`${Math.floor(position.size * 0.25)}\`\n\n`,
                { parse_mode: "Markdown" }
            );
        } else {
            await ctx.answerCbQuery("❌ Invalid sell type");
            return ctx.reply("❌ Invalid sell type selected. Please try again.");
        }

        if (amountToSell <= 0) {
            await ctx.answerCbQuery("❌ Invalid amount");
            return ctx.reply("❌ Unable to calculate sell amount. Please try again.");
        }

        await ctx.answerCbQuery(`Processing ${sellType}% sell order...`);
        return handleCloseOpenPosition(ctx, conditionId, amountToSell);
    }

    if (data.startsWith("delete_copy_wallet:")) {
        const walletAddress = data.split(":")[1];
        await handleDeleteUserWallet(ctx, walletAddress);
        await ctx.deleteMessage();
        return;
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

    if (data.startsWith("toggle_copy_trade:")) {
        const action = data.split(":")[1];
        return handleToggleCopyTradeStatus(ctx, action === "true" ? true : false);
    }

    if (data.startsWith("toggle_wallet_ct:")) {
        const address = data.split(":")[1];
        await handleToggleWalletCopyTradeStatus(ctx, address);
        return handleAutoTradeMenu(ctx);
    }

    if (data === "enable_copy_trade") {
        return handleEnableCopyTrade(ctx);
    }

    if (data === "stop_copy_trade") {
        return handleStopCopyTrade(ctx);
    }

    if (data === "back_to_main_menu") {
        const userId = getUserIdFromCtx(ctx);

        const { data: existingUser, error: dbError } = await getUserByIdFromDb(userId);
        if (dbError || !existingUser) {
            return ctx.reply("❌ Something Went Wrong. Please Try Again Later.");
        }

        const [balance, user, solBalance] = await Promise.all([
            getUserWrappedUSDCBalance(existingUser.wallet_address),
            getUserDetails(userId),
            getSOLBalance(existingUser.solana_address!),
        ]);

        if (!user) {
            return ctx.reply("❌ Internal Server Error");
        }

        const message = generateWelcomeMessage(
            existingUser.wallet_address,
            existingUser.solana_address || "N/A",
            balance.toString(),
            solBalance,
            user?.locked_balance
        );

        return ctx.editMessageText(message, {
            parse_mode: "HTML",
            reply_markup: Markup.inlineKeyboard(MAIN_MENU_BUTTONS).reply_markup,
        });
    }

    if (data === "view_cancel_order_menu") {
        return handleCancelOpenOrdersCommand(ctx);
    }

    if (data.startsWith("orders:")) {
        const [, _, offsetStr] = data.split(":");
        const offset = parseInt(offsetStr, 10);
        const userId = getUserIdFromCtx(ctx);
        const trackedOrderIds = await redisClient.lRange(`user:order_ids:${userId}`, 0, -1);
        const unmatchedOrders = await getUnmatchedOpenOrders(userId, trackedOrderIds);

        if (!unmatchedOrders || unmatchedOrders.length === 0) {
            return ctx
                .editMessageText("✅ No unmatched open orders found.")
                .catch(() => ctx.reply("✅ No unmatched open orders found."));
        }

        return sendPaginatedOrder(ctx, unmatchedOrders, offset);
    }

    if (data.startsWith("refresh_order:")) {
        const offset = parseInt(data.split(":")[1], 10);
        const userId = getUserIdFromCtx(ctx);
        const trackedOrderIds = await redisClient.lRange(`user:order_ids:${userId}`, 0, -1);
        const unmatchedOrders = await getUnmatchedOpenOrders(userId, trackedOrderIds);
        if (!unmatchedOrders || unmatchedOrders.length === 0) {
            return ctx.editMessageText("✅ No unmatched open orders found.");
        }
        return sendPaginatedOrder(ctx, unmatchedOrders, offset);
    }

    if (data.startsWith("refresh_portfolio:")) {
        const index = parseInt(data.split(":")[1], 10);
        const userId = getUserIdFromCtx(ctx);
        const userAddress = await getUserAddressFromId(userId);

        if (!userAddress) {
            return ctx.answerCbQuery("⚠️ No linked wallet.");
        }

        const userPositions = await getUserPosition({ user: userAddress });

        if (!userPositions || userPositions.length === 0) {
            return ctx.editMessageText("✅ No open positions found.");
        }

        if (index >= userPositions.length) {
            return ctx.answerCbQuery("⚠️ Invalid index.");
        }

        const { text, markup } = formatSinglePositionMessage(
            userPositions[index],
            index,
            userPositions.length
        );

        try {
            await ctx.editMessageText(text, {
                parse_mode: "Markdown",
                reply_markup: markup,
            });
            await ctx.answerCbQuery("🔄 Refreshed!");
        } catch (err) {
            console.error("Refresh failed:", err);
            await ctx.answerCbQuery("⚠️ Could not refresh.");
        }
    }

    if (data.startsWith("cancel_order:")) {
        const orderId = decodeMarketId(data.split(":")[1]);
        return handleCancelOrderCallback(ctx, orderId);
    }

    if (data.startsWith("refresh_market:")) {
        const marketId = data.split(":")[1];
        return handleRefreshMarket(ctx, marketId);
    }

    if (data.startsWith("refresh_market_details:")) {
        const marketId = data.split(":")[1];
        return handleRefreshMarketDetails(ctx, marketId);
    }

    if (data.startsWith("refresh_markets:")) {
        const eventId = data.split(":")[1];
        return handleRefreshMarkets(ctx, eventId);
    }

    if (data.startsWith("refresh_top_markets:")) {
        const [marketCategory, filter, offset] = data.split(":").slice(1);
        return handleRefreshTopMarkets(ctx, marketCategory, filter, offset);
    }

    if (data.startsWith("history:")) {
        const [, offsetStr, walletAddress] = data.split(":");
        const offset = parseInt(offsetStr, 10);

        return sendPaginatedHistory(ctx, walletAddress, offset);
    }

    if (data === "close_message") {
        return ctx.deleteMessage();
    }
}

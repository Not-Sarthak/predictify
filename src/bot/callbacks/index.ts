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
    handleShowZeroDTEMarketsByCategory,
    handleGeneratePortfolioCard,
} from "./trade";
import { getMarketById } from "../../utils/polymarket/get-markets";
import { formatOrderBook, escapeMarkdown } from "../utils";
import { encodeMarketId } from "../../utils/encoding";
import { handleStartMenuCallbacks, handleViewProfileCallback } from "./start";
import {
    handleSubscriptionMenuCallbacks,
    handleSubscriptionManagement,
    handleShowCurrentPriceAlerts,
} from "./subscriptions";
import {
    handleAddNewWalletCallback,
    handleDeleteWalletCallback,
    handleViewWatchedWallets,
    handleCopyTradeConfigureMenu,
    handleCopyTradeConfigCallbacks,
    handleConfigureWalletsMenu,
    handleConfigureWallet,
    handleSetWalletPercentage,
} from "./autotrade";
import {
    handleResetWallet,
    handleSwapFundsCallback,
    handleSwapFundsQuoteCallback,
    handleWalletSettingsMenu,
} from "./settings";
import { handleExportPrivateKey } from "../utils/database/export-user-private-key";
import { handleWithdrawSOL, handleWithdrawUSDC } from "../../utils/withdrawal";
import {
    handleBridgeConfirm,
    handleBridgeFunds,
    handleBridgeStatus,
} from "../../utils/debridge/functions/bridge-handler";
import { handleHighProbCallbackQuery } from "./high-probability";
import { redisClient } from "../../lib/redis";
import { CLOSE_BUTTON, MAIN_MENU_BUTTONS } from "../ui/buttons";
import { Markup, type Context } from "telegraf";
import {
    handleToggleCopyTradeStatus,
    handleToggleWalletCopyTradeStatus,
} from "../utils/database/toggle-copytrade-status";
import { formatSinglePositionMessage, getUserByIdFromDb, getUserIdFromCtx } from "../utils";
import {
    generate0DTEMarketCategoryKeyboard,
    generateAutoTradeMenu,
    generateWelcomeMessage,
    handleAutoTradeMenu,
} from "../ui/messages";
import { getSOLBalance, getUserWrappedUSDCBalance } from "../../helpers/get-user-balance";
import { handleOrderDetailsTextMessage } from "../input/order-details";
import { getUserPosition, getUserPositionByMarket } from "../../utils/polymarket/get-user-position";
import { getUserAddressFromId } from "../../helpers/get-user-address-from-id";
import { decodeMarketId } from "../../utils/encoding";
import { setUserInputState } from "../input/state";
import { handleCancelOpenOrdersCommand, sendPaginatedOrder } from "../commands/manage-limit-orders";
import { getUserDetails } from "../../helpers/get-user-details";
import type { ApiKeyCreds } from "../../types/polymarket";
import { createLegacyWallet } from "../../utils";
import { decryptPrivateKey } from "../../utils/crypto";
import { ethers } from "ethers";
import { ClobClient } from "@polymarket/clob-client";
import { CHAIN_ID, HOST } from "../../shared/constants";
import { sendPaginatedHistory } from "../commands/history";
import { getUnmatchedOpenOrders } from "../../utils/polymarket/get-non-matched-orders";
import { getLockedBalance } from "../../utils/polymarket/get-locked-balance";
import { db } from "../../lib/supabase";
import { getMarketQuestion } from "../../notifier/utils";
import { handleWatchlistCommand } from "../commands";
import { handleConfirmRedeem, handleRedeemPosition } from "./redeem";
import { stopAllTpSlWatchers, stopPriceAlertWatcher } from "../../notifier/ws/price-watcher";

/**
 * TODO:FIX
 * Change the conditional check to a Switch Statement and move ctx.answerCbQuery() at the end.
 * So that the button loading animation is done only when info is retrieved by the user.
 */
export async function handleCallbackQuery(ctx: Context) {
    const data =
        ctx.callbackQuery && "data" in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;

    // Only answer callback query if it's actually a callback query context
    if ("answerCbQuery" in ctx && ctx.callbackQuery) {
        await ctx.answerCbQuery();
    }

    if (!data) return;

    const userId = getUserIdFromCtx(ctx);
    const userIdStr = userId.toString();

    /**
     * Handle Callbacks based on Data Value
     */

    if (data.startsWith("highprob:")) {
        return handleHighProbCallbackQuery(ctx, data);
    }

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

    if (data === "edit_price_alerts") {
        return handleShowCurrentPriceAlerts(ctx);
    }

    if (data.startsWith("alert_nav:")) {
        const page = parseInt(data.split(":")[1]);
        await ctx.answerCbQuery();
        return handleShowCurrentPriceAlerts(ctx, page, true);
    }

    if (data.startsWith("alert_delete:")) {
        const shortKey = data.split(":")[1];

        const fullFieldKey = await redisClient.hGet(`user:price_alert_keys:${userId}`, shortKey);
        if (!fullFieldKey) {
            return ctx.answerCbQuery("❌ Alert not found.");
        }

        const [marketId, assetId] = fullFieldKey.split(":");
        await redisClient.hDel(`user:price_alerts:${userId}`, fullFieldKey);
        await redisClient.hDel(`user:price_alert_keys:${userId}`, shortKey);
        stopPriceAlertWatcher(userIdStr, marketId, assetId);

        await ctx.answerCbQuery("✅ Alert deleted");
        return handleShowCurrentPriceAlerts(ctx, 0, true);
    }

    if (data.startsWith("alert_edit:")) {
        const shortKey = data.split(":")[1];

        const fullKey = await redisClient.hGet(`user:price_alert_keys:${userId}`, shortKey);
        const configStr = await redisClient.hGet(`user:price_alerts:${userId}`, fullKey as string);
        if (!fullKey || !configStr) {
            return ctx.answerCbQuery("❌ Alert not found.");
        }

        const config = JSON.parse(configStr);
        const marketTitle = await getMarketQuestion(config.marketId);

        await redisClient.hSet(`user:edit_price_alert:${userId}`, shortKey, configStr);
        await setUserInputState(userIdStr, "edit_price_alert");

        return ctx.reply(
            `✏️ <b>Edit Price Alert</b>\n\n` +
                `<b>Market:</b> ${marketTitle}\n` +
                `<b>Current Trigger:</b> ${config.price}\n\n` +
                `Please send a new price for this alert (between 0 and 1).`,
            { parse_mode: "HTML" }
        );
    }

    if (data.startsWith("close_position:")) {
        const encodedConditioId = data.split(":")[1];
        return handleCloseOpenPosition(ctx, encodedConditioId);
    }

    if (data === "view_profile") {
        return handleViewProfileCallback(ctx);
    }

    if (data === "show_portfolio" || data === "trade_position_view") {
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

    if (data === "copy_trade_configure_menu") {
        return handleCopyTradeConfigureMenu(ctx);
    }

    if (data === "configure_wallets") {
        return handleConfigureWalletsMenu(ctx);
    }

    if (data.startsWith("config_wallet:")) {
        const walletAddress = data.split(":")[1];
        return handleConfigureWallet(ctx, walletAddress);
    }

    if (data.startsWith("set_wallet_percent:")) {
        const [, walletAddress, percentage] = data.split(":");
        return handleSetWalletPercentage(ctx, walletAddress, percentage);
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
        const encodedMarketId = data.split(":")[1];
        const marketId = decodeMarketId(encodedMarketId);
        return handleViewMarket(ctx, marketId);
    }

    if (data.startsWith("view_market:")) {
        const marketId = data.split(":")[1];
        return handleViewMarket(ctx, marketId);
    }

    if (data.startsWith("portfolio_page")) {
        const page = data.split(":")[1];
        return handleTradePagination(ctx, page);
    }

    if (data === "trade_markets_dte") {
        const keyboard = await generate0DTEMarketCategoryKeyboard();

        return ctx.reply("⚡ <b>Trending 0DTE Markets:</b>", {
            parse_mode: "HTML",
            ...keyboard,
        });
    }

    if (data.startsWith("zero_dte_category:")) {
        const category = data.split(":")[1];
        const offset = data.split(":")[2];

        return handleShowZeroDTEMarketsByCategory(ctx, category, Number(offset) || 0);
    }

    if (data === "back_to_zero_dte_categories") {
        const keyboard = await generate0DTEMarketCategoryKeyboard();

        return ctx.editMessageText("⚡ <b>Trending 0DTE Markets:</b>", {
            parse_mode: "HTML",
            ...keyboard,
        });
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

    if (data.startsWith("market_details:")) {
        const encodedMarketId = data.split(":")[1];
        const marketId = decodeMarketId(encodedMarketId);
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
        const [encodedMarketId, side] = data.split(":").slice(1);
        const marketId = decodeMarketId(encodedMarketId);

        await redisClient.hSet(`user:order_context:${userId}`, {
            marketId,
            orderType: "gtc",
            side: side.toUpperCase(),
        });

        await setUserInputState(userIdStr, "orderDetails");
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

        await redisClient.hSet(`user:order_context:${userId}`, {
            marketId,
            orderType: "fok",
            side: side.toUpperCase(),
        });

        await setUserInputState(userIdStr, "orderDetails");
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

        await setUserInputState(userIdStr, "orderDetails");
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

        await redisClient.hSet(`user:order_context:${userId}`, {
            marketId,
            orderType: "fok_sell",
            side: "SELL",
        });

        await setUserInputState(userIdStr, "orderDetails");
        return ctx.reply(
            `💵 **Sell Position**\n\n` +
                `Enter The Amount in USDC You Want to Sell:\n\n` +
                `**Format:** \`<amount>\`\n` +
                `**Example:** \`25\`\n\n`,
            { parse_mode: "Markdown" }
        );
    }

    // Handle Sell Percentage Callbacks
    if (
        data.startsWith("sell_50_") ||
        data.startsWith("sell_100_") ||
        data.startsWith("sell_custom_")
    ) {
        const parts = data.split("_");
        const sellType = parts[1]; // "50", "100", or "custom"
        const conditionId = parts.slice(2).join("_"); // Handle encoded market IDs
        const decodedConditionId = decodeMarketId(conditionId);

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

            await redisClient.hSet(`user:order_context:${userId}`, {
                marketId: conditionId,
                sellType: "50",
                remainingSize: position.size - amountToSell,
            });
        } else if (sellType === "100") {
            amountToSell = position.size;
        } else if (sellType === "custom") {
            await redisClient.hSet(`user:order_context:${userId}`, {
                marketId: conditionId,
                sellType: "custom",
                originalSize: position.size,
            });

            await setUserInputState(userIdStr, "close_position");
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

    if (data.startsWith("redeem_position_")) {
        const conditionId = data.replace("redeem_position_", "");
        return handleRedeemPosition(ctx, conditionId);
    }

    if (data.startsWith("confirm_redeem_")) {
        const conditionId = data.replace("confirm_redeem_", "");
        return handleConfirmRedeem(ctx, conditionId);
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
        const { data: existingUser, error: dbError } = await getUserByIdFromDb(userId);
        if (dbError || !existingUser) {
            return ctx.reply("❌ Something Went Wrong. Please Try Again Later.");
        }

        const [balance, user, solBalance, lockedBalance] = await Promise.all([
            getUserWrappedUSDCBalance(existingUser.wallet_address),
            getUserDetails(userId),
            getSOLBalance(existingUser.solana_address!),
            getLockedBalance(userId),
        ]);

        if (!user) {
            return ctx.reply("❌ Internal Server Error");
        }

        const message = generateWelcomeMessage(
            existingUser.wallet_address,
            existingUser.solana_address || "N/A",
            balance.toString(),
            solBalance,
            lockedBalance
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
        const trackedOrderIds = await redisClient.lRange(`user:order_ids:${userId}`, 0, -1);
        const unmatchedOrders = await getUnmatchedOpenOrders(userId, trackedOrderIds);
        if (!unmatchedOrders || unmatchedOrders.length === 0) {
            return ctx.editMessageText("✅ No unmatched open orders found.");
        }
        return sendPaginatedOrder(ctx, unmatchedOrders, offset);
    }

    if (data.startsWith("refresh_portfolio:")) {
        const index = parseInt(data.split(":")[1], 10);
        const userAddress = await getUserAddressFromId(userId);

        if (!userAddress) {
            return ctx.answerCbQuery("⚠️ No linked wallet.");
        }

        const userPositions = await getUserPosition({ user: userAddress });
        const filteredUserPositions = userPositions.filter((position) => !position.redeemable);

        if (!filteredUserPositions || filteredUserPositions.length === 0) {
            return ctx.editMessageText("✅ No open positions found.");
        }

        if (index >= filteredUserPositions.length) {
            return ctx.answerCbQuery("⚠️ Invalid index.");
        }

        const { text, markup } = await formatSinglePositionMessage(
            userIdStr,
            filteredUserPositions[index],
            index,
            filteredUserPositions.length
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
        const encodedMarketId = data.split(":")[1];
        const marketId = decodeMarketId(encodedMarketId);
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

    if (data.startsWith("set_price_alert:")) {
        const encodedMarketId = data.split(":")[1];

        await redisClient.hSet(`user:order_context:${userId}`, {
            marketId: encodedMarketId,
        });

        setUserInputState(userIdStr, "set_price_alert");

        const message = `🔔 <b>Set Price Alert for this Market</b>\n
Enter <b>Price</b> & <b>Side</b> details below:\n
Format: <code>Price</code> <code>Yes/No</code>\n
Example: <code>0.7</code> <code>No</code>`;

        return ctx.reply(message, {
            parse_mode: "HTML",
        });
    }

    if (data.startsWith("take_profit:") || data.startsWith("stop_loss:")) {
        const action = data.split(":")[0];
        const marketId = decodeMarketId(data.split(":")[1]);

        const userAddress = await getUserAddressFromId(userId);
        if (!userAddress) {
            return ctx.reply("❌ Internal Server Error");
        }

        const userPositionsByMarkets = await getUserPositionByMarket(userAddress, marketId);
        if (!userPositionsByMarkets) {
            return ctx.reply("❌ You don't have an open Position in this Market");
        }

        const { size, outcome, asset, curPrice } = userPositionsByMarkets;

        await redisClient.hSet(`user:order_context:${userId}`, {
            size,
            tokenId: asset,
            action,
            marketId,
            outcome,
            currentPrice: curPrice,
        });

        const isTp = action === "take_profit";

        const message = isTp ? "💸 Set Take Profit" : "🛑 Set Stop Loss";
        const cbId = isTp ? "tp" : "sl";

        const keyboard = [
            [
                Markup.button.callback("25%", `${cbId}:25`),
                Markup.button.callback("50%", `${cbId}:50`),
                Markup.button.callback("100%", `${cbId}:100`),
            ],
            [Markup.button.callback("Custom", `${cbId}:custom`)],
        ];

        return ctx.reply(message, {
            parse_mode: "HTML",
            reply_markup: Markup.inlineKeyboard(keyboard).reply_markup,
        });
    }

    if (data.startsWith("tp:") || data.startsWith("sl:")) {
        const type = data.split(":")[1];

        if (type === "custom") {
            setUserInputState(userIdStr, "tp_sl_share_input");
            return ctx.reply("Enter the Percentage of Shares");
        }

        await redisClient.hSet(`user:order_context:${userId}`, {
            type,
        });

        setUserInputState(userIdStr, "tp_sl_price_input");
        return ctx.reply("Enter the Price");
    }

    if (data.startsWith("stop_tp:")) {
        const marketId = decodeMarketId(data.split(":")[1]);

        await stopAllTpSlWatchers(userIdStr, marketId, "tp");

        return ctx.reply("✅ TP/SL Stopped for the Current Market.");
    }

    if (data.startsWith("stop_sl:")) {
        const marketId = decodeMarketId(data.split(":")[1]);

        await stopAllTpSlWatchers(userIdStr, marketId, "sl");

        return ctx.reply("✅ TP/SL Stopped for the Current Market.");
    }

    if (data.startsWith("toggle_show_username")) {
        const toggleTo = data.split(":")[1] === "1";

        const { error } = await db("Users")
            .update({ show_username_in_cards: toggleTo })
            .eq("id", userId);

        if (error) {
            return ctx.reply("❌ Internal Server Error. Failed to Update your preferences.");
        }

        const toggleButtonTitle = toggleTo
            ? "❌ Hide Username (PnL Cards)"
            : "✅ Show Username (PnL Cards)";

        const toggleButtonCallbackData = toggleTo
            ? "toggle_show_username:0"
            : "toggle_show_username:1";

        ctx.reply(`✅ Your Username will be ${toggleTo ? "*Shown*" : "*Hidden*"}`, {
            parse_mode: "Markdown",
        });
        return ctx.editMessageReplyMarkup(
            Markup.inlineKeyboard([
                [Markup.button.callback(toggleButtonTitle, toggleButtonCallbackData)],
                [CLOSE_BUTTON],
            ]).reply_markup
        );
    }

    if (data.startsWith("ts:")) {
        const shareKey = data.substring(3);
        const shareDataStr = await redisClient.get(shareKey);

        if (!shareDataStr) {
            await ctx.answerCbQuery("❌ Share link expired");
            return ctx.editMessageReplyMarkup(Markup.inlineKeyboard([[CLOSE_BUTTON]]).reply_markup);
        }

        const shareData = JSON.parse(shareDataStr);

        const { marketTitle, side, pnl, pnlType, entryPrice, exitPrice } = shareData;
        const emoji = pnlType === "Positive" ? "🚀" : pnlType === "Negative" ? "📉" : "➖";
        const pnlText =
            pnlType === "Positive" ? `+$${pnl}` : pnlType === "Negative" ? `-$${pnl}` : `$${pnl}`;

        const tweetText = encodeURIComponent(
            `${emoji} Just closed my ${side} position on "${marketTitle}"!\n\n` +
                `Entry: ${entryPrice}%\n` +
                `Exit: ${exitPrice}%\n` +
                `PnL: ${pnlText}\n\n` +
                `Trading on @Polymarket via @PredictifyBot 🎯`
        );

        const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;

        const shareKeyboard = Markup.inlineKeyboard([
            [Markup.button.url("🐦 Open X", twitterUrl)],
            [CLOSE_BUTTON],
        ]);

        await ctx.answerCbQuery("✅ Opening X..");
        return ctx.editMessageReplyMarkup(shareKeyboard.reply_markup);
    }

    if (data.startsWith("add_watchlist:")) {
        const encodedMarketId = data.split(":")[1];
        const marketId = decodeMarketId(encodedMarketId);
        return handleAddToWatchlist(ctx, marketId);
    }

    if (data.startsWith("remove_watchlist:")) {
        const encodedMarketId = data.split(":")[1];
        const marketId = decodeMarketId(encodedMarketId);
        return handleRemoveFromWatchlist(ctx, marketId);
    }

    if (data === "refresh_watchlist") {
        await ctx.deleteMessage();
        return handleWatchlistCommand(ctx);
    }

    if (data.startsWith("watchlist_page:")) {
        const page = parseInt(data.split(":")[1]);
        await ctx.deleteMessage();
        return handleWatchlistCommand(ctx, page);
    }

    if (data.startsWith("watchlist_market:")) {
        const marketId = data.split(":")[1];
        // Show market with additional context that it's from watchlist
        return handleViewMarketFromWatchlist(ctx, marketId);
    }

    if (data === "generate_portfolio_card") {
        return handleGeneratePortfolioCard(ctx);
    }

    if (data === "clear_watchlist") {
        return handleClearWatchlist(ctx);
    }

    if (data === "back_to_watchlist") {
        await ctx.deleteMessage();
        return handleWatchlistCommand(ctx);
    }

    if (data === "close_message") {
        return ctx.deleteMessage();
    }
}

async function handleAddToWatchlist(ctx: Context, marketId: string) {
    const userId = getUserIdFromCtx(ctx);

    try {
        // Fetch market details
        const market = await getMarketById(marketId);
        if (!market) {
            await ctx.answerCbQuery("❌ Market not found");
            return;
        }

        // Get current watched markets
        const { data: user, error: fetchError } = await db("Users")
            .select("market_watchlist")
            .eq("id", userId)
            .single();

        if (fetchError || !user) {
            await ctx.answerCbQuery("❌ Error adding to watchlist");
            return;
        }

        const currentWatchlist = user.market_watchlist || [];

        // Check if already in watchlist by conditionId
        //@ts-expect-error Some should be allowed
        const isAlreadyInWatchlist = currentWatchlist.some(
            (item: any) => item.conditionId === market.conditionId
        );

        if (isAlreadyInWatchlist) {
            await ctx.answerCbQuery("Already in watchlist");
            return;
        }

        // Check limit
        //@ts-expect-error Length exists
        if (currentWatchlist.length >= 20) {
            await ctx.answerCbQuery("❌ Watchlist full (20 max)");
            return;
        }

        // Create market object to store
        const marketToStore = {
            conditionId: market.conditionId,
            marketId: market.id,
            question: market.question,
            title: market.title || market.question,
            groupItemTitle: market.groupItemTitle,
            endDate: market.endDate,
            addedAt: new Date().toISOString(),
        };

        // Add to watchlist
        //@ts-expect-error Ignore here, because of the above reasons
        const updatedWatchlist = [...currentWatchlist, marketToStore];

        const { error: updateError } = await db("Users")
            .update({ market_watchlist: updatedWatchlist })
            .eq("id", userId);

        if (updateError) {
            await ctx.answerCbQuery("❌ Error updating watchlist");
            return;
        }

        await ctx.answerCbQuery("✅ Added to watchlist");

        // Update the button to show "Remove from Watchlist"
        const message = ctx.callbackQuery?.message;
        if (
            message &&
            "reply_markup" in message &&
            message.reply_markup &&
            "inline_keyboard" in message.reply_markup
        ) {
            const newKeyboard = message.reply_markup.inline_keyboard.map((row) =>
                row.map((button) => {
                    if (
                        "callback_data" in button &&
                        button.callback_data === `add_watchlist:${encodeMarketId(marketId)}`
                    ) {
                        return Markup.button.callback(
                            "💔 Remove from Watchlist",
                            `remove_watchlist:${encodeMarketId(marketId)}`
                        );
                    }
                    return button;
                })
            );

            await ctx.editMessageReplyMarkup(Markup.inlineKeyboard(newKeyboard).reply_markup);
        }
    } catch (error) {
        console.error("Error in handleAddToWatchlist:", error);
        await ctx.answerCbQuery("❌ Error occurred");
    }
}

async function handleRemoveFromWatchlist(ctx: Context, marketId: string) {
    const userId = getUserIdFromCtx(ctx);

    try {
        // Get current watched markets
        const { data: user, error: fetchError } = await db("Users")
            .select("market_watchlist")
            .eq("id", userId)
            .single();

        if (fetchError || !user) {
            await ctx.answerCbQuery("❌ Error removing from watchlist");
            return;
        }

        const currentWatchlist = user.market_watchlist || [];

        // Remove from watchlist by marketId
        //@ts-expect-error Filter should be allowed
        const updatedWatchlist = currentWatchlist.filter((item: any) => item.marketId !== marketId);

        const { error: updateError } = await db("Users")
            .update({ market_watchlist: updatedWatchlist })
            .eq("id", userId);

        if (updateError) {
            await ctx.answerCbQuery("❌ Error updating watchlist");
            return;
        }

        await ctx.answerCbQuery("✅ Removed from watchlist");

        // Check if this was called from the watchlist view
        const message = ctx.callbackQuery?.message;
        if (
            message &&
            "reply_markup" in message &&
            message.reply_markup &&
            "inline_keyboard" in message.reply_markup
        ) {
            // Check if there's a "Back to Watchlist" button (indicating we're in watchlist view)
            const hasBackButton = message.reply_markup.inline_keyboard.some((row) =>
                row.some(
                    (button) =>
                        "callback_data" in button && button.callback_data === "back_to_watchlist"
                )
            );

            if (hasBackButton) {
                // If from watchlist, show confirmation and redirect back
                await ctx.deleteMessage();
                await ctx.reply(
                    "✅ **Market Removed from Watchlist**\n\n" +
                        "The market has been removed from your watchlist.",
                    { parse_mode: "Markdown" }
                );

                // Wait a moment then show the watchlist again
                setTimeout(async () => {
                    await handleWatchlistCommand(ctx);
                }, 1000);
            } else {
                // Otherwise, just update the button
                const newKeyboard = message.reply_markup.inline_keyboard.map((row) =>
                    row.map((button) => {
                        if (
                            "callback_data" in button &&
                            button.callback_data === `remove_watchlist:${encodeMarketId(marketId)}`
                        ) {
                            return Markup.button.callback(
                                "❤️ Add to My Watchlist",
                                `add_watchlist:${encodeMarketId(marketId)}`
                            );
                        }
                        return button;
                    })
                );

                await ctx.editMessageReplyMarkup(Markup.inlineKeyboard(newKeyboard).reply_markup);
            }
        }
    } catch (error) {
        console.error("Error in handleRemoveFromWatchlist:", error);
        await ctx.answerCbQuery("❌ Error occurred");
    }
}

async function handleClearWatchlist(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);

    try {
        const { error } = await db("Users").update({ market_watchlist: [] }).eq("id", userId);

        if (error) {
            await ctx.answerCbQuery("❌ Error clearing watchlist");
            return;
        }

        await ctx.answerCbQuery("✅ Watchlist cleared");
        await ctx.deleteMessage();

        return ctx.reply(
            "❤️ **Your Watchlist has been Cleared**\n\n" +
                "You can add markets back to your watchlist anytime.",
            { parse_mode: "Markdown" }
        );
    } catch (error) {
        console.error("Error in handleClearWatchlist:", error);
        await ctx.answerCbQuery("❌ Error occurred");
    }
}

async function handleViewMarketFromWatchlist(ctx: Context, marketId: string) {
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

    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback("⚡ Market Yes", `market_order:${market.id}:yes`),
            Markup.button.callback("⚡ Market No", `market_order:${market.id}:no`),
        ],
        [
            Markup.button.callback("🎯 Limit Yes", `limit_order:${encodeMarketId(market.id)}:yes`),
            Markup.button.callback("🎯 Limit No", `limit_order:${encodeMarketId(market.id)}:no`),
        ],
        [
            Markup.button.callback(
                "🔔 Set Price Alert",
                `set_price_alert:${encodeMarketId(market.conditionId)}`
            ),
        ],
        [
            Markup.button.callback(
                "💔 Remove from Watchlist",
                `remove_watchlist:${encodeMarketId(market.id)}`
            ),
        ],
        [
            Markup.button.callback(
                "ℹ️ About this Market",
                `market_details:${encodeMarketId(market.id)}`
            ),
        ],
        [
            Markup.button.callback("⬅️ Back to Watchlist", "back_to_watchlist"),
            Markup.button.callback("❌ Close", "close_message"),
        ],
    ]);

    return ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: keyboard.reply_markup,
    });
}

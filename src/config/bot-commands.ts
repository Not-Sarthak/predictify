import { Context, Markup } from "telegraf";
import { getUserWrappedUSDCBalance } from "../helpers/get-user-balance";
import { generateAPIKeyAndWallet } from "../utils/polymarket/generate-user";
import { HOST, CHAIN_ID } from "../constants/polymarket";
import {
    generateMainMenuButtons,
    formatWelcomeMessage,
    handleStartCallbacks,
    handleSubscriptionMenuCallbacks,
    handleSubscriptionCallbacks,
    handleUnsubscriptionCallbacks,
    handleTradeCallbacks,
    handleCloseMenu,
    handleWalletSettingsMenuCallbacks,
    handleAddNewWalletCallback,
    handleDeleteWalletCallback,
    handleDeleteUserWallet,
    handleViewTradePositions,
    handleFetchMarketWithOffsetCallback,
    handleSelectedMarketCallback,
    handleManageTradePositionsCallback,
} from "../utils/telegram";
import { supabase } from "./supabase";
import { handleExportPrivateKey } from "../helpers/export-user-private-key";
import {
    awaitingMarketTermInputSet,
    awaitingOrderDetailsInputSet,
    awaitingWalletDetailsInputSet,
} from "./bot";
import { redisClient } from "./redis";
import {
    handleMarketTermTextMessage,
    handleOrderDetailsTextMessage,
    handleWalletDetailsTextMessage,
} from "../utils/telegram/text-handlers";

/* Command Handlers */
export async function handleStartCommand(ctx: Context) {
    try {
        const userId = ctx.from?.id;
        const userName = ctx.from?.username;

        const { data: existingUser, error: fetchError } = await supabase
            .from("Users")
            .select("*")
            .eq("id", userId)
            .single();

        if (fetchError && fetchError.code !== "PGRST116") {
            console.error("Error Checking Existing User:", fetchError);
            return ctx.reply("❌ Something Went Wrong. Please Try Again Later.");
        }

        if (existingUser) {
            // User already exists
            const balance = await getUserWrappedUSDCBalance(existingUser.wallet_address);

            const message = formatWelcomeMessage(
                existingUser.wallet_address,
                existingUser.solana_address,
                balance.toString(),
                JSON.parse(existingUser.api_credentials)
            );

            const inlineKeyboard = Markup.inlineKeyboard(generateMainMenuButtons()).reply_markup;

            return ctx.reply(message, {
                parse_mode: "HTML",
                reply_markup: inlineKeyboard,
            });
        }

        const walletData = await generateAPIKeyAndWallet({
            host: HOST,
            chainId: CHAIN_ID,
        });

        const address = walletData.address;
        const balance = await getUserWrappedUSDCBalance(address);

        const { error } = await supabase.from("Users").insert([
            {
                id: userId,
                telegram_username: userName,
                wallet_address: address,
                private_key: walletData.privateKey,
                api_credentials: JSON.stringify(walletData.apiCreds),
            },
        ]);

        if (error) {
            console.error("Error Inserting New User:", error);
            return ctx.reply("❌ There Was an Error Creating Your Account.");
        }

        const inlineKeyboard = Markup.inlineKeyboard(generateMainMenuButtons()).reply_markup;

        const message = formatWelcomeMessage(address, "", balance.toString(), walletData.apiCreds);

        return ctx.reply(message, {
            parse_mode: "HTML",
            reply_markup: inlineKeyboard,
        });
    } catch (error) {
        console.error("Error Generating Wallet:", error);
        return ctx.reply("❌ Failed to Generate Wallet. Please Try Again.");
    }
}

export async function handleUserTextMessage(ctx: Context) {
    const textMessage = ctx.text?.trim();
    if (!textMessage) return;

    const userId = ctx.from?.id.toString();
    if (!userId) return;

    if (awaitingWalletDetailsInputSet.has(userId)) {
        return handleWalletDetailsTextMessage(ctx, textMessage, userId);
    }

    if (awaitingMarketTermInputSet.has(userId)) {
        return handleMarketTermTextMessage(ctx, textMessage, userId);
    }

    if (awaitingOrderDetailsInputSet.has(userId)) {
        return handleOrderDetailsTextMessage(ctx, textMessage, userId);
    }
}

/* Callback Query Handler */
export async function handleCallbackQuery(ctx: Context) {
    const data = (ctx.callbackQuery as any).data as string;

    // Handle Start Menu
    if (data.startsWith("start_")) {
        const action = data.split("_")[1];
        return handleStartCallbacks(ctx, action);
    }

    // Handle Subscription Menu
    if (data.startsWith("subscription_")) {
        const action = data.split("_")[1];
        return handleSubscriptionMenuCallbacks(ctx, action);
    }

    // Handle Subscription Callbacks
    if (data.startsWith("subscribe_")) {
        const category = data.split("_")[1];
        return handleSubscriptionCallbacks(ctx, category);
    }

    // Handle Unsubscription Callbacks
    if (data.startsWith("unsubscribe_")) {
        const category = data.split("_")[1];
        return handleUnsubscriptionCallbacks(ctx, category);
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

    // Handle Selected Order
    if (data.startsWith("selected_order:")) {
        const userId = ctx.from?.id.toString()!;
        const [marketId, orderType] = data.split(":").splice(1);

        await redisClient.hSet(`user:order_context:${userId}`, {
            marketId,
            orderType,
        });
        awaitingOrderDetailsInputSet.add(userId);

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

    // Handle View Open Trade Positions
    if (data === "trade_position_view") {
        return handleViewTradePositions(ctx);
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

    // Handle Delete User Wallet
    if (data.startsWith("delete_copy_wallet:")) {
        const walletAddress = data.split(":")[1];
        return handleDeleteUserWallet(ctx, walletAddress);
    }

    // Handle Wallet Settings Menu Callback
    if (data === "wallet_settings_menu") {
        return handleWalletSettingsMenuCallbacks(ctx);
    }

    // Handle Exporting Private Key
    if (data.startsWith("export_private_key:")) {
        const network = data.split(":")[1];
        return handleExportPrivateKey(ctx, network as "evm" | "solana");
    }

    // Handle Add New Wallet
    if (data === "add_new_wallet") {
        return handleAddNewWalletCallback(ctx);
    }

    // Handle Delete Wallet Callback
    if (data === "delete_wallet") {
        return handleDeleteWalletCallback(ctx);
    }

    // Handle Close Menu
    if (data === "close_menu") {
        return handleCloseMenu(ctx);
    }

    return ctx.answerCbQuery();
}

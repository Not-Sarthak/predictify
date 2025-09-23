import { Markup, type Context } from "telegraf";
import { getMayanQuote } from "./get-mayan-quote";
import { createMayanBridgeOrder } from "./create-mayan-order";
import { getUserDetails } from "../../../helpers/get-user-details";
import { getSOLBalance } from "../../../helpers/get-user-balance";
import { CLOSE_BUTTON } from "../../../bot/ui/buttons";
import { getUserIdFromCtx } from "../../../bot/utils";
import { getUserLanguage } from "../../../helpers/user-language";
import { t, getMessages } from "../../../i18n";
import { decryptPrivateKey } from "../../../utils/crypto";
import { needsPOLForGas } from "../../../helpers/get-pol-balance";
import {
    calculateBridgeAllocation,
    createPOLBridgeOrder,
} from "../../debridge/functions/pol-bridge-handler";
import {
    MIN_POL_BALANCE_THRESHOLD,
    POL_ACQUISITION_AMOUNT,
} from "../../../shared/constants/polymarket";
import { getUserWalletAddresses } from "../../../bot/utils/database/get-user-addresses";
import { clearCache } from "../../cache";
import type { BridgeQuoteData, MayanBridgeInput } from "../types";
import { SUPPORTED_CHAINS, SOLANA_TOKENS, POLYGON_TOKENS, MIN_BRIDGE_AMOUNTS } from "../types";

const MIN_BALANCE = 0.015;
const SLIPPAGE_BPS = 300; // 3% slippage

const bridgeQuotes = new Map<string, BridgeQuoteData>();

export async function handleBridgeFunds(ctx: Context): Promise<void> {
    const userId = getUserIdFromCtx(ctx).toString();
    const userIdNumber = parseInt(userId);

    const language = await getUserLanguage(userIdNumber);

    try {
        await ctx.answerCbQuery();

        const user = await getUserWalletAddresses(userIdNumber);

        // Clear cache and fetch fresh SOL balance
        await clearCache(`user:${userId}:sol_balance`);
        const solBalance = await getSOLBalance(user!.solana_address);
        console.log("User SOL Balance:", solBalance);

        if (solBalance <= MIN_BALANCE) {
            await ctx.reply(
                `❌ ${t("insufficientSolBalance", language)} ${t("youHaveSol", language)} ${solBalance.toFixed(4)} ${t("butNeedAtLeast", language)} ${MIN_BALANCE.toFixed(4)} ${t("solToBridge", language)}`
            );
            return;
        }

        // Calculate max bridgeable amount (balance - reserve for fees)
        const maxBridgeable = Math.max(0, solBalance - MIN_BRIDGE_AMOUNTS.RESERVE);
        console.log("Max Bridgeable Amount:", maxBridgeable);

        if (maxBridgeable < MIN_BRIDGE_AMOUNTS.SOL) {
            const language = await getUserLanguage(userIdNumber);
            const totalNeeded = MIN_BRIDGE_AMOUNTS.SOL + MIN_BRIDGE_AMOUNTS.RESERVE;
            await ctx.reply(
                `❌ **Insufficient SOL for Bridge**\n\n` +
                    `📊 **Current Balance:** ${solBalance.toFixed(4)} SOL\n` +
                    `💰 **Available to Bridge:** ${maxBridgeable.toFixed(4)} SOL\n` +
                    `🚫 **Minimum Required:** ${MIN_BRIDGE_AMOUNTS.SOL.toFixed(3)} SOL\n\n` +
                    `**You need at least ${totalNeeded.toFixed(3)} SOL total:**\n` +
                    `• ${MIN_BRIDGE_AMOUNTS.SOL.toFixed(3)} SOL to bridge\n` +
                    `• ${MIN_BRIDGE_AMOUNTS.RESERVE.toFixed(3)} SOL for transaction fees\n\n` +
                    `💡 **Get more SOL first, then try bridging again.**`,
                { parse_mode: "Markdown" }
            );
            return;
        }

        // Fetch quote with the safe bridgeable amount
        await fetchAndShowQuote(ctx);
    } catch (error) {
        console.error("Error in handleBridgeFunds:", error);
        await ctx.reply("❌ An Error Occurred While Preparing the Bridge. Please Try Again.");
    }
}

async function fetchAndShowQuote(ctx: Context): Promise<void> {
    const userId = getUserIdFromCtx(ctx).toString();
    const userIdNumber = parseInt(userId);

    const language = await getUserLanguage(userIdNumber);

    try {
        const loadingMsg = await ctx.reply("⏳ Fetching Bridge Quote...");

        const user = await getUserWalletAddresses(userIdNumber);
        if (!user) {
            const language = await getUserLanguage(userIdNumber);
            const messages = getMessages(language);
            await ctx.telegram.editMessageText(
                loadingMsg.chat.id,
                loadingMsg.message_id,
                undefined,
                `❌ Please set up both your ${messages.solana} and EVM wallets first.`
            );
            return;
        }

        // Clear cache and fetch fresh SOL balance to avoid stale data
        await clearCache(`user:${userId}:sol_balance`);
        const solBalance = await getSOLBalance(user.solana_address);

        // Calculate max bridgeable amount
        const maxBridgeableSOL = Math.max(0, solBalance - MIN_BRIDGE_AMOUNTS.RESERVE);

        if (maxBridgeableSOL < MIN_BRIDGE_AMOUNTS.SOL) {
            const totalNeeded = MIN_BRIDGE_AMOUNTS.SOL + MIN_BRIDGE_AMOUNTS.RESERVE;
            await ctx.telegram.editMessageText(
                loadingMsg.chat.id,
                loadingMsg.message_id,
                undefined,
                `❌ **Bridge Amount Too Small**\n\n` +
                    `📊 **Current Balance:** ${solBalance.toFixed(4)} SOL\n` +
                    `💰 **Available to Bridge:** ${maxBridgeableSOL.toFixed(4)} SOL\n` +
                    `🚫 **Minimum Required:** ${MIN_BRIDGE_AMOUNTS.SOL.toFixed(3)} SOL\n\n` +
                    `**You need at least ${totalNeeded.toFixed(3)} SOL total:**\n` +
                    `• ${MIN_BRIDGE_AMOUNTS.SOL.toFixed(3)} SOL to bridge\n` +
                    `• ${MIN_BRIDGE_AMOUNTS.RESERVE.toFixed(3)} SOL for fees\n\n` +
                    `💡 **Get more SOL first, then try bridging again.**`,
                { parse_mode: "Markdown" }
            );
            return;
        }

        // Check if user needs POL for gas fees
        const needsPOL = await needsPOLForGas(user.wallet_address);

        let polAllocation = 0;
        let usdcAllocation = maxBridgeableSOL;
        let polBridgeData = null;

        if (needsPOL) {
            try {
                // Calculate allocation for POL and USDC
                const allocation = await calculateBridgeAllocation(
                    maxBridgeableSOL,
                    0, // Already reserved above
                    POL_ACQUISITION_AMOUNT
                );

                polAllocation = allocation.polAllocation;
                usdcAllocation = allocation.usdcAllocation;

                // Get POL bridge quote (using debridge for POL, Mayan for USDC)
                polBridgeData = await createPOLBridgeOrder({
                    solAmount: allocation.polAllocationLamports,
                    recipientAddress: user.wallet_address,
                    senderAddress: user.solana_address,
                });

                // If POL bridge fails, fall back to USDC-only bridge
                if (!polBridgeData) {
                    console.warn("POL bridge not available, falling back to USDC-only");
                    polAllocation = 0;
                    usdcAllocation = maxBridgeableSOL;
                }
            } catch (error) {
                console.warn("POL bridge setup failed, falling back to USDC-only:", error);
                // Fall back to USDC-only bridge
                polAllocation = 0;
                usdcAllocation = maxBridgeableSOL;
            }
        }

        const bridgeAmount = usdcAllocation;
        const lamportsAmount = Math.floor(bridgeAmount * 1e9).toString();

        const bridgeParams: MayanBridgeInput = {
            amountIn64: lamportsAmount,
            fromToken: SOLANA_TOKENS.SOL,
            toToken: POLYGON_TOKENS.USDC,
            fromChain: SUPPORTED_CHAINS.SOLANA,
            toChain: SUPPORTED_CHAINS.POLYGON,
            slippageBps: SLIPPAGE_BPS,
            recipientAddress: user.wallet_address,
            senderAddress: user.solana_address,
        };

        const quote = await getMayanQuote(bridgeParams);
        console.log("Mayan Quote:", quote);

        // Validate quote response
        if (!quote || !quote.expectedAmountOut) {
            throw new Error("Invalid bridge quote response from Mayan");
        }

        const outputAmount = quote.expectedAmountOut;

        // Calculate total input amount for display
        const totalInputAmount = polAllocation + bridgeAmount;
        const bridgeFee = quote.bridgeFee || 0;

        const quoteKey = `bridge_quote_${userId}`;
        bridgeQuotes.set(quoteKey, {
            userId,
            amount: totalInputAmount.toString(),
            estimatedOutput: outputAmount.toString(),
            fees: bridgeFee.toString(),
            quote,
            polAllocation,
            usdcAllocation,
            needsPOL,
            polBridgeData,
        });

        // Generate quote message with POL information
        let quoteMessage = `🌉 **Bridge Quote**\n\n`;

        if (needsPOL && polAllocation > 0) {
            quoteMessage += `💡 **Auto POL Acquisition Enabled**\n`;
            quoteMessage += `Your wallet has insufficient POL for gas fees (< ${MIN_POL_BALANCE_THRESHOLD} POL)\n\n`;
            quoteMessage += `**Bridge Breakdown:**\n`;
            quoteMessage += `• ${polAllocation.toFixed(4)} SOL → POL tokens (gas fees)\n`;
            quoteMessage += `• ${bridgeAmount.toFixed(4)} SOL → ${outputAmount.toFixed(2)} USDC\n\n`;
            quoteMessage += `**Total:** ${totalInputAmount.toFixed(4)} SOL\n`;
        } else {
            const messages = getMessages(language);
            quoteMessage += `**You Send:** ${totalInputAmount.toFixed(4)} ${t("sol", language)} (${messages.solana})\n`;
            quoteMessage += `**You Receive:** ${outputAmount.toFixed(2)} USDC (${t("polygon", language) || "Polygon"})\n\n`;
        }

        quoteMessage += `**Exchange Rate:** 1 ${t("sol", language)} ≈ ${(outputAmount / bridgeAmount).toFixed(2)} USDC\n`;
        quoteMessage += `**Bridge Fee:** ${bridgeFee.toFixed(4)} ${t("sol", language)}\n`;
        quoteMessage += `**Wallet Balance:** ${solBalance.toFixed(4)} ${t("sol", language)}\n`;
        quoteMessage += `**Reserved for Fees:** ${MIN_BRIDGE_AMOUNTS.RESERVE} ${t("sol", language)}\n`;
        quoteMessage += `**ETA:** ~${Math.ceil(quote.etaSeconds / 60)} minutes\n\n`;

        if (needsPOL && polAllocation > 0) {
            quoteMessage += `✅ This will provide sufficient POL for ~100-200 transactions\n`;
        }

        quoteMessage += `🔋 **Powered by Mayan Finance**`;

        const confirmButtons = [
            [Markup.button.callback(`✅ ${t("confirm", language)}`, `bridge_confirm:${userId}`)],
            [CLOSE_BUTTON],
        ];

        await ctx.telegram.editMessageText(
            loadingMsg.chat.id,
            loadingMsg.message_id,
            undefined,
            quoteMessage,
            {
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard(confirmButtons),
            }
        );
    } catch (error) {
        console.error("Error Fetching Mayan Bridge Quote:", error);

        let errorMessage = "❌ **Failed to Fetch Bridge Quote**\n\n";

        if (error instanceof Error) {
            if (error.message.includes("insufficient") || error.message.includes("too small")) {
                errorMessage += `🚫 **Bridge Amount Too Small**\n\n`;
                errorMessage += `The amount you're trying to bridge is below the minimum threshold.\n\n`;
                errorMessage += `**Required:** At least ${MIN_BRIDGE_AMOUNTS.SOL + MIN_BRIDGE_AMOUNTS.RESERVE} SOL total\n`;
                errorMessage += `• ${MIN_BRIDGE_AMOUNTS.SOL} SOL minimum to bridge\n`;
                errorMessage += `• ${MIN_BRIDGE_AMOUNTS.RESERVE} SOL for transaction fees\n\n`;
                errorMessage += `💡 **Solution:** Get more SOL in your wallet first, then try again.`;
            } else {
                errorMessage += `**Error:** ${error.message}`;
            }
        } else {
            errorMessage += "**Error:** Unknown error occurred";
        }

        await ctx.reply(errorMessage, { parse_mode: "Markdown" });
    }
}

export async function handleBridgeConfirm(ctx: Context, userId: string): Promise<void> {
    const quoteKey = `bridge_quote_${userId}`;
    const userIdNumber = parseInt(userId);

    const language = await getUserLanguage(userIdNumber);

    try {
        await ctx.answerCbQuery();

        const storedQuote = bridgeQuotes.get(quoteKey);

        if (!storedQuote) {
            await ctx.reply("❌ Bridge quote expired. Please start over.");
            return;
        }

        const processingMsg = await ctx.reply("⏳ Processing Bridge Transaction...");

        const user = await getUserDetails(userIdNumber);

        if (!user || !user.solana_address) {
            await ctx.telegram.editMessageText(
                processingMsg.chat.id,
                processingMsg.message_id,
                undefined,
                "❌ User not found or wallet not configured."
            );
            return;
        }

        if (!user.solana_private_key) {
            throw new Error("Solana private key not found");
        }

        const decryptedPrivateKey = decryptPrivateKey(user.solana_private_key);
        let polTxSignature: string | null = null;
        let usdcTxSignature: string | null = null;

        // Execute POL bridge first if needed (using debridge)
        if (storedQuote.needsPOL && storedQuote.polBridgeData) {
            try {
                await ctx.telegram.editMessageText(
                    processingMsg.chat.id,
                    processingMsg.message_id,
                    undefined,
                    "🔄 Step 1/2: Acquiring POL tokens for gas fees..."
                );

                // Import the existing debridge execution function
                const { executeSolanaTransaction } = await import("../../solana/transaction");
                polTxSignature = await executeSolanaTransaction(
                    decryptedPrivateKey,
                    storedQuote.polBridgeData.tx.data
                );

                await ctx.telegram.editMessageText(
                    processingMsg.chat.id,
                    processingMsg.message_id,
                    undefined,
                    "✅ POL acquisition initiated\n🔄 Step 2/2: Bridging SOL to USDC with Mayan..."
                );
            } catch (error) {
                console.error("POL bridge failed:", error);
                await ctx.telegram.editMessageText(
                    processingMsg.chat.id,
                    processingMsg.message_id,
                    undefined,
                    "⚠️ POL acquisition failed, proceeding with USDC bridge only..."
                );
            }
        } else {
            await ctx.telegram.editMessageText(
                processingMsg.chat.id,
                processingMsg.message_id,
                undefined,
                "🔄 Signing and sending bridge transaction with Mayan..."
            );
        }

        // Execute USDC bridge using Mayan
        const bridgeResult = await createMayanBridgeOrder(
            storedQuote.quote,
            user.solana_address,
            user.wallet_address,
            decryptedPrivateKey
        );

        if (!bridgeResult || !bridgeResult.txHash) {
            await ctx.telegram.editMessageText(
                processingMsg.chat.id,
                processingMsg.message_id,
                undefined,
                "❌ Failed to create USDC bridge transaction. Please try again."
            );
            return;
        }

        usdcTxSignature = bridgeResult.txHash;

        bridgeQuotes.delete(quoteKey);

        // Generate success message
        let successMessage = `✅ **Bridge Transaction(s) Submitted**\n\n`;

        if (storedQuote.needsPOL && polTxSignature) {
            successMessage += `🔸 **POL Acquisition:** ${storedQuote.polAllocation?.toFixed(4)} SOL → POL tokens\n`;
            successMessage += `[View POL Tx](https://solscan.io/tx/${polTxSignature})\n\n`;
        }

        successMessage += `🔸 **Main Bridge:** ${storedQuote.usdcAllocation?.toFixed(4)} ${t("sol", language)} → ${parseFloat(storedQuote.estimatedOutput).toFixed(2)} USDC\n`;
        successMessage += `**Network:** ${t("solana", language)} → ${t("polygon", language) || "Polygon"}\n\n`;
        successMessage += `🔄 **Status:** Processing\n\n`;
        successMessage += `[View Bridge Tx](https://solscan.io/tx/${usdcTxSignature})\n`;
        successMessage += `[Track on Mayan Explorer](https://explorer.mayan.finance/swap/${usdcTxSignature})\n\n`;

        if (storedQuote.needsPOL) {
            successMessage += `✅ Your wallet will have sufficient POL for gas fees once processing completes\n\n`;
        }

        successMessage += `🔋 **Powered by Mayan Finance**`;

        const statusButtons = [
            [Markup.button.callback(`🏠 ${t("mainMenu", language)}`, "back_to_main_menu")],
        ];

        await clearCache(`user:${userId}:sol_balance`);

        await ctx.telegram.editMessageText(
            processingMsg.chat.id,
            processingMsg.message_id,
            undefined,
            successMessage,
            {
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard(statusButtons),
            }
        );
    } catch (error) {
        bridgeQuotes.delete(quoteKey);
        console.error("Bridge execution error:", error);
        await ctx.reply(
            `❌ Bridge Execution Failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
    }
}

export async function handleBridgeStatus(ctx: Context, userId: string): Promise<void> {
    await ctx.answerCbQuery();

    const language = await getUserLanguage(parseInt(userId));
    await ctx.reply(
        "🔍 **Transaction Status**\n\n⏳ Your bridge transaction is being processed.\n\nPlease check your wallet in a few minutes.\n\n🔋 **Powered by Mayan Finance**",
        {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
                [Markup.button.callback(getMessages(language).refresh, `bridge_status:${userId}`)],
                [Markup.button.callback(`🏠 ${t("mainMenu", language)}`, "back_to_main_menu")],
            ]),
        }
    );
}

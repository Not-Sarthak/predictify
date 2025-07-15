import { Markup, type Context } from "telegraf";
import { getBridgeQuote } from "./get-bridge-quote";
import { createDebridgeBridgeOrder } from "./create-bridge-order";
import { ChainId } from "../types";
import type { deBridgeOrderInput } from "../types";
import { getUserDetails } from "../../../helpers/get-user-details";
import { getSOLBalance } from "../../../helpers/get-user-balance";
import { CLOSE_BUTTON } from "@/bot/ui/buttons";
import { executeSolanaTransaction } from "../../solana/transaction";
import { decryptPrivateKey } from "../../../utils/crypto";

const SOLANA_CHAIN_ID = ChainId.Solana;
const POLYGON_CHAIN_ID = ChainId.Polygon;
const SOL_TOKEN_ADDRESS = "11111111111111111111111111111111";
const USDC_POLYGON_ADDRESS = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";
const SLIPPAGE_TOLERANCE = 0.5;

interface BridgeQuoteData {
    userId: string;
    amount: string;
    estimatedOutput: string;
    fees: string;
    quoteData: any;
}

const bridgeQuotes = new Map<string, BridgeQuoteData>();

export async function handleBridgeFunds(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) {
        await ctx.answerCbQuery();
        await ctx.reply("❌ Unable to identify user.");
        return;
    }
    try {
        await ctx.answerCbQuery();

        const user = await getUserDetails(Number(userId));
        if (!user || !user.solana_address) {
            await ctx.reply("❌ Please Set Up Your Solana Wallet First.");
            return;
        }

        const solBalance = await getSOLBalance(user.solana_address);
        if (solBalance < 0.01) {
            await ctx.reply("❌ Insufficient SOL Balance. You Need at least 0.01 SOL to Bridge.");
            return;
        }

        await fetchAndShowQuote(ctx, solBalance.toString());
    } catch (error) {
        await ctx.reply("❌ An Error Occurred While Preparing the Bridge. Please Try Again.");
    }
}

async function fetchAndShowQuote(ctx: Context, amount: string): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) {
        await ctx.reply("❌ Unable to identify user.");
        return;
    }

    try {
        const loadingMsg = await ctx.reply("⏳ Fetching Bridge Quote...");

        const user = await getUserDetails(Number(userId));
        if (!user || !user.solana_address || !user.wallet_address) {
            await ctx.telegram.editMessageText(
                loadingMsg.chat.id,
                loadingMsg.message_id,
                undefined,
                "❌ Please set up both your Solana and EVM wallets first."
            );
            return;
        }

        const bridgeAmount = parseFloat(amount);
        if (isNaN(bridgeAmount) || bridgeAmount <= 0) {
            await ctx.telegram.editMessageText(
                loadingMsg.chat.id,
                loadingMsg.message_id,
                undefined,
                "❌ Invalid Amount."
            );
            return;
        }
        const solBalance = await getSOLBalance(user.solana_address);
        if (solBalance < bridgeAmount) {
            await ctx.telegram.editMessageText(
                loadingMsg.chat.id,
                loadingMsg.message_id,
                undefined,
                `❌ Insufficient SOL Balance.`
            );
            return;
        }

        const lamportsAmount = Math.floor(bridgeAmount * 1e9).toString();

        const bridgeParams: deBridgeOrderInput = {
            srcChainId: SOLANA_CHAIN_ID,
            srcChainTokenIn: SOL_TOKEN_ADDRESS,
            srcChainTokenInAmount: lamportsAmount,
            dstChainId: POLYGON_CHAIN_ID,
            dstChainTokenOut: USDC_POLYGON_ADDRESS,
            dstChainTokenOutRecipient: user.wallet_address,
            account: user.solana_address,
            slippage: SLIPPAGE_TOLERANCE,
        };

        const quote = await getBridgeQuote(bridgeParams);

        // Use the original user input amount
        const inputAmount = bridgeAmount;

        // Validate quote response
        if (
            !quote.estimation?.dstChainTokenOut?.amount ||
            !quote.estimation?.dstChainTokenOut?.decimals
        ) {
            throw new Error("Invalid bridge quote response - missing destination token data");
        }

        if (
            !quote.estimation?.srcChainTokenIn?.amount ||
            !quote.estimation?.srcChainTokenIn?.decimals
        ) {
            throw new Error("Invalid bridge quote response - missing source token data");
        }

        const outputAmount =
            parseFloat(quote.estimation.dstChainTokenOut.amount) /
            Math.pow(10, quote.estimation.dstChainTokenOut.decimals);

        const totalAmountNeeded =
            parseFloat(quote.estimation.srcChainTokenIn.amount) /
            Math.pow(10, quote.estimation.srcChainTokenIn.decimals);

        const bridgeFee = totalAmountNeeded - inputAmount;

        const quoteKey = `bridge_quote_${userId}`;
        bridgeQuotes.set(quoteKey, {
            userId,
            amount: bridgeAmount.toString(),
            estimatedOutput: outputAmount.toString(),
            fees: bridgeFee.toString(),
            quoteData: bridgeParams,
        });

        const quoteMessage = `🌉 **Bridge Quote**

**You Send:** ${inputAmount.toFixed(4)} SOL (Solana)
**You Receive:** ${outputAmount.toFixed(2)} USDC (Polygon)
**Total Deducted:** ${totalAmountNeeded.toFixed(4)} SOL
**Bridge Fee:** ${bridgeFee.toFixed(4)} SOL

**Exchange Rate:** 1 SOL ≈ ${(outputAmount / inputAmount).toFixed(2)} USDC
`;

        const confirmButtons = [
            [Markup.button.callback("✅ Confirm Bridge", `bridge_confirm:${userId}`)],
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
        console.error("Error Fetching Bridge Quote:", error);
        await ctx.reply(
            `❌ Failed to Fetch Bridge Quote: ${error instanceof Error ? error.message : "Unknown error"}`
        );
    }
}

export async function handleBridgeConfirm(ctx: Context, userId: string): Promise<void> {
    try {
        await ctx.answerCbQuery();

        const quoteKey = `bridge_quote_${userId}`;
        const storedQuote = bridgeQuotes.get(quoteKey);

        if (!storedQuote) {
            await ctx.reply("❌ Bridge quote expired. Please start over.");
            return;
        }

        const processingMsg = await ctx.reply("⏳ Processing Bridge Transaction...");

        const user = await getUserDetails(Number(userId));
        if (!user) {
            await ctx.telegram.editMessageText(
                processingMsg.chat.id,
                processingMsg.message_id,
                undefined,
                "❌ User not found."
            );
            return;
        }

        const bridgeResult = await createDebridgeBridgeOrder(storedQuote.quoteData);

        if (!bridgeResult || !bridgeResult.tx || !bridgeResult.tx.data) {
            await ctx.telegram.editMessageText(
                processingMsg.chat.id,
                processingMsg.message_id,
                undefined,
                "❌ Failed to create bridge transaction. Please try again."
            );
            return;
        }

        // Execute the Solana transaction
        let txSignature: string;
        try {
            await ctx.telegram.editMessageText(
                processingMsg.chat.id,
                processingMsg.message_id,
                undefined,
                "🔄 Signing and sending transaction..."
            );

            if (!user.solana_private_key) {
                throw new Error("Solana private key not found");
            }

            const decryptedPrivateKey = decryptPrivateKey(user.solana_private_key);
            txSignature = await executeSolanaTransaction(decryptedPrivateKey, bridgeResult.tx.data);
        } catch (error) {
            console.error("Transaction execution error:", error);
            await ctx.telegram.editMessageText(
                processingMsg.chat.id,
                processingMsg.message_id,
                undefined,
                `❌ Failed to execute bridge transaction: ${error instanceof Error ? error.message : "Unknown error"}`
            );
            return;
        }

        bridgeQuotes.delete(quoteKey);

        const successMessage = `✅ **Bridge Transaction Submitted**

**Amount:** ${storedQuote.amount} SOL → ${parseFloat(storedQuote.estimatedOutput).toFixed(2)} USDC
**Network:** Solana → Polygon

**Transaction Details:**
• Signature: \`${txSignature}\`
• Order ID: \`${bridgeResult.orderId || "N/A"}\`

🔄 **Status:** Processing
⏱️ **Estimated Time:** 2-10 minutes

[View on Solscan](https://solscan.io/tx/${txSignature})
[Track on DeBridge](https://app.debridge.finance/order?orderId=${bridgeResult.orderId || ""})`;

        const statusButtons = [
            [Markup.button.callback("🔍 Check Status", `bridge_status:${userId}`)],
            [Markup.button.callback("🏠 Main Menu", "back_to_main_menu")],
        ];

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
        console.error("Error confirming bridge:", error);
        await ctx.reply(
            `❌ Bridge Execution Failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
    }
}

export async function handleBridgeStatus(ctx: Context, userId: string): Promise<void> {
    await ctx.answerCbQuery();

    await ctx.reply(
        "🔍 **Transaction Status**\n\n⏳ Your bridge transaction is being processed.\n\nPlease check your wallet in a few minutes.",
        {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
                [Markup.button.callback("🔄 Refresh", `bridge_status:${userId}`)],
                [Markup.button.callback("🏠 Main Menu", "back_to_main_menu")],
            ]),
        }
    );
}

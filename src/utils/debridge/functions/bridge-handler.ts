import { Markup, type Context } from "telegraf";
import { getBridgeQuote } from "./get-bridge-quote";
import { createDebridgeBridgeOrder } from "./create-bridge-order";
import { ChainId } from "../types";
import type { deBridgeOrderInput } from "../types";
import { getUserDetails } from "../../../helpers/get-user-details";
import { getSOLBalance } from "../../../helpers/get-user-balance";
import { awaitingBridgeAmountInputSet } from "../../../bot";

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

        const amountButtons = [
            [
                Markup.button.callback("0.1 SOL", `bridge_amount:0.1`),
                Markup.button.callback("0.5 SOL", `bridge_amount:0.5`),
            ],
            [
                Markup.button.callback("1 SOL", `bridge_amount:1`),
                Markup.button.callback("2 SOL", `bridge_amount:2`),
            ],
            [
                Markup.button.callback("5 SOL", `bridge_amount:5`),
                Markup.button.callback("Custom", `bridge_amount:custom`),
            ],
            [Markup.button.callback("🔙 Back", "back_to_main_menu")],
        ];

        const message = `🌉 **Bridge SOL to USDC (Polygon)**

Current SOL Balance: **${solBalance.toFixed(4)} SOL**

Select the Amount You Want to Bridge:`;

        await ctx.reply(message, {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard(amountButtons),
        });
    } catch (error) {
        console.error("Error in handleBridgeFunds:", error);
        await ctx.reply("❌ An error occurred while preparing the bridge. Please try again.");
    }
}

export async function handleBridgeAmount(ctx: Context, amount: string): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) {
        await ctx.answerCbQuery();
        await ctx.reply("❌ Unable to identify user.");
        return;
    }

    try {
        await ctx.answerCbQuery();

        if (amount === "custom") {
            awaitingBridgeAmountInputSet.add(userId);
            await ctx.reply(
                "✍️ Please enter the amount of SOL you want to bridge:\n\nExample: 1.5",
                {
                    parse_mode: "Markdown",
                    ...Markup.inlineKeyboard([[Markup.button.callback("🔙 Back", "bridge_funds")]]),
                }
            );
            return;
        }

        await fetchAndShowQuote(ctx, amount);
    } catch (error) {
        console.error("Error in handleBridgeAmount:", error);
        await ctx.reply("❌ An error occurred. Please try again.");
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
        console.log("📦 Bridge Quote Response:", JSON.stringify(quote, null, 2));

        // Use the original user input amount
        const inputAmount = bridgeAmount;
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
            [Markup.button.callback("🔙 Back", "bridge_funds")],
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

        const processingMsg = await ctx.reply("⏳ Processing bridge transaction...");

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

        if (!bridgeResult || !bridgeResult.tx) {
            await ctx.telegram.editMessageText(
                processingMsg.chat.id,
                processingMsg.message_id,
                undefined,
                "❌ Failed to create bridge transaction. Please try again."
            );
            return;
        }

        bridgeQuotes.delete(quoteKey);

        const successMessage = `✅ **Bridge Transaction Created**

**Amount:** ${storedQuote.amount} SOL → ${parseFloat(storedQuote.estimatedOutput).toFixed(2)} USDC
**Network:** Solana → Polygon

**Transaction Details:**
• Contract: \`${bridgeResult.tx.to}\`
• Value: \`${bridgeResult.tx.value}\`

🔄 **Status:** Processing
⏱️ **Estimated Time:** 2-10 minutes

You can track your transaction status using DeBridge explorer.`;

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
            `❌ Bridge execution failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
    }
}

export async function handleCustomBridgeAmount(ctx: Context, inputAmount: string): Promise<void> {
    const amount = parseFloat(inputAmount.trim());

    if (isNaN(amount) || amount <= 0) {
        await ctx.reply("❌ Invalid Amount. Please Enter a Valid Number.");
        return;
    }

    if (amount < 0.01) {
        await ctx.reply("❌ Minimum Bridge Amount is 0.01 SOL.");
        return;
    }

    await fetchAndShowQuote(ctx, amount.toString());
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

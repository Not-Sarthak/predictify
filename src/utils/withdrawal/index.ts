import { Markup, type Context } from "telegraf";
import { getUserDetails } from "../../helpers/get-user-details";
import { getUserWrappedUSDCBalance } from "../../helpers/get-user-balance";
import { CLOSE_BUTTON } from "../../bot/ui/buttons";
import { ethers } from "ethers";
import { env } from "../../config";
import { getBridgeQuote } from "../debridge/functions/get-bridge-quote";
import { ChainId } from "../debridge/types";
import { executeSwapUSDCeToUSDC } from "../uniswap";
import { decryptPrivateKey } from "../../utils/crypto";
import { clearUserInputState, setUserInputState } from "../../bot/input/state";

interface WithdrawalData {
    type: "sol" | "usdc";
    userId: string;
}

const withdrawalDataMap = new Map<string, WithdrawalData>();

const USDCE_ADDRESS = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";
const USDC_ADDRESS = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
const SOL_NATIVE_ADDRESS = "11111111111111111111111111111111";
const USDC_DECIMALS = 6;
const MIN_WITHDRAWAL_AMOUNT = 5;
const MIN_GAS_BALANCE_POL = 1;

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
];

async function validateAndSetupWithdrawal(
    ctx: Context,
    type: "sol" | "usdc"
): Promise<{ user: any; userId: string; balance: number } | null> {
    const userId = ctx.from?.id.toString();
    if (!userId) {
        await ctx.answerCbQuery();
        await ctx.reply("❌ Unable to identify user.");
        return null;
    }

    await ctx.answerCbQuery();

    const user = await getUserDetails(Number(userId));
    if (!user?.wallet_address) {
        await ctx.reply("❌ Please set up your wallet first.");
        return null;
    }

    const balance = await getUserWrappedUSDCBalance(user.wallet_address);
    if (balance < MIN_WITHDRAWAL_AMOUNT) {
        await ctx.reply(
            `❌ Insufficient USDCe balance. You need at least ${MIN_WITHDRAWAL_AMOUNT} USDCe to withdraw.`
        );
        return null;
    }

    // Check POL balance for gas fees
    const provider = new ethers.JsonRpcProvider(env.MAINNET_RPC_URL);
    const polBalance = await provider.getBalance(user.wallet_address);
    const polBalanceInEther = parseFloat(ethers.formatEther(polBalance));

    if (polBalanceInEther < MIN_GAS_BALANCE_POL) {
        await ctx.reply(
            `❌ Insufficient POL for gas fees. You need at least ${MIN_GAS_BALANCE_POL} POL to cover transaction fees.\n\nCurrent POL balance: ${polBalanceInEther.toFixed(4)} POL`
        );
        return null;
    }

    withdrawalDataMap.set(userId, { type, userId });
    await setUserInputState(userId.toString(), "withdrawal");

    return { user, userId, balance };
}

export async function handleWithdrawSOL(ctx: Context): Promise<void> {
    try {
        const result = await validateAndSetupWithdrawal(ctx, "sol");
        if (!result) return;

        const message = `💸 **Withdraw to SOL**

Current Balance: **${result.balance.toFixed(2)} USDCe**

Please enter the amount and destination Solana address in this format:
\`<amount> <destination_address>\`

Example: \`10 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TLRuJosgAsU\`

Note: Your USDCe will be bridged to SOL on Solana`;

        await ctx.reply(message, {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([[CLOSE_BUTTON]]),
        });
    } catch (error) {
        console.error("Error in handleWithdrawSOL:", error);
        await ctx.reply("❌ An error occurred. Please try again.");
    }
}

export async function handleWithdrawUSDC(ctx: Context): Promise<void> {
    try {
        const result = await validateAndSetupWithdrawal(ctx, "usdc");
        if (!result) return;

        const message = `💵 **Withdraw to USDC**

Current Balance: **${result.balance.toFixed(2)} USDCe**

Please enter the amount and destination Polygon address in this format:
\`<amount> <destination_address>\`

Example: \`10 0x742d35Cc6634C0532925a3b844Bc9e7595f2BD4e\`

Note: Your USDCe will be swapped to USDC on Polygon`;

        await ctx.reply(message, {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([[CLOSE_BUTTON]]),
        });
    } catch (error) {
        console.error("Error in handleWithdrawUSDC:", error);
        await ctx.reply("❌ An error occurred. Please try again.");
    }
}

export async function handleWithdrawalInput(ctx: Context, input: string): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) {
        await ctx.reply("❌ Unable to identify user.");
        return;
    }

    const withdrawalData = withdrawalDataMap.get(userId);
    if (!withdrawalData) {
        await ctx.reply("❌ Withdrawal session expired. Please start again.");
        return;
    }

    try {
        const parts = input.trim().split(/\s+/);
        if (parts.length !== 2) {
            await ctx.reply("❌ Invalid format. Please use: `<amount> <destination_address>`", {
                parse_mode: "Markdown",
            });
            return;
        }

        const [amountStr, destinationAddress] = parts;
        const amount = parseFloat(amountStr);

        if (isNaN(amount) || amount <= 0) {
            await ctx.reply("❌ Invalid amount. Please enter a positive number.");
            return;
        }

        if (withdrawalData.type === "sol") {
            if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(destinationAddress)) {
                await ctx.reply("❌ Invalid Solana address. Please check and try again.");
                return;
            }
        } else {
            if (!ethers.isAddress(destinationAddress)) {
                await ctx.reply("❌ Invalid Polygon address. Please check and try again.");
                return;
            }
        }

        const user = await getUserDetails(Number(userId));
        if (!user?.wallet_address || !user?.private_key) {
            await ctx.reply("❌ User wallet not found.");
            return;
        }

        const balance = await getUserWrappedUSDCBalance(user.wallet_address);
        if (balance < amount) {
            await ctx.reply(
                `❌ Insufficient balance. You have ${balance.toFixed(2)} USDCe available.`
            );
            return;
        }

        if (amount < MIN_WITHDRAWAL_AMOUNT) {
            await ctx.reply(`❌ Minimum withdrawal amount is ${MIN_WITHDRAWAL_AMOUNT} USDCe.`);
            return;
        }

        // Check POL balance for gas fees
        const provider = new ethers.JsonRpcProvider(env.MAINNET_RPC_URL);
        const polBalance = await provider.getBalance(user.wallet_address);
        const polBalanceInEther = parseFloat(ethers.formatEther(polBalance));

        if (polBalanceInEther < MIN_GAS_BALANCE_POL) {
            await ctx.reply(
                `❌ Insufficient POL for gas fees. You need at least ${MIN_GAS_BALANCE_POL} POL to cover transaction fees.\n\nCurrent POL balance: ${polBalanceInEther.toFixed(4)} POL`
            );
            return;
        }

        const processingMsg = await ctx.reply("⏳ Processing withdrawal...");

        if (withdrawalData.type === "sol") {
            await processSOLWithdrawal(ctx, user, amount, destinationAddress, processingMsg);
        } else {
            await processUSDCWithdrawal(ctx, user, amount, destinationAddress, processingMsg);
        }

        withdrawalDataMap.delete(userId);
        await clearUserInputState(userId.toString());
    } catch (error) {
        console.error("Error processing withdrawal:", error);
        await ctx.reply(
            `❌ Withdrawal failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
    }
}

async function updateProcessingMessage(ctx: Context, msg: any, text: string): Promise<void> {
    await ctx.telegram.editMessageText(msg.chat.id, msg.message_id, undefined, text, {
        parse_mode: "Markdown",
    });
}

async function processSOLWithdrawal(
    ctx: Context,
    user: any,
    amount: number,
    destinationAddress: string,
    processingMsg: any
): Promise<void> {
    try {
        const provider = new ethers.JsonRpcProvider(env.MAINNET_RPC_URL);
        const decryptedKey = decryptPrivateKey(user.private_key);
        const wallet = new ethers.Wallet(decryptedKey, provider);

        const quote = await getBridgeQuote({
            srcChainId: ChainId.Polygon,
            srcChainTokenIn: USDCE_ADDRESS,
            srcChainTokenInAmount: (amount * 10 ** USDC_DECIMALS).toString(),
            dstChainId: ChainId.Solana,
            dstChainTokenOut: SOL_NATIVE_ADDRESS,
            dstChainTokenOutRecipient: destinationAddress,
            account: wallet.address,
        });

        if (!quote?.tx) {
            throw new Error("Failed to get bridge quote");
        }

        const usdceContract = new ethers.Contract(USDCE_ADDRESS, ERC20_ABI, wallet);
        const spenderAddress = quote.tx.to;
        const amountInWei = ethers.parseUnits(amount.toString(), USDC_DECIMALS);

        const currentAllowance = await usdceContract.allowance(wallet.address, spenderAddress);
        if (currentAllowance < amountInWei) {
            await updateProcessingMessage(ctx, processingMsg, "⏳ Approving USDCe for bridge...");
            const approveTx = await usdceContract.approve(spenderAddress, amountInWei);
            await approveTx.wait();
        }

        await updateProcessingMessage(ctx, processingMsg, "⏳ Executing bridge transaction...");
        const tx = await wallet.sendTransaction({
            to: quote.tx.to,
            data: quote.tx.data,
            value: quote.tx.value,
        });

        const receipt = await tx.wait();

        const successMessage = `✅ **Withdrawal Successful**

**Amount:** ${amount} USDCe → SOL
**To:** \`${destinationAddress}\`
**Transaction:** \`${receipt?.hash || ""}\`

[View on Polygonscan](https://polygonscan.com/tx/${receipt?.hash})

Note: Bridge processing may take 5-10 minutes. Check your Solana wallet shortly.`;

        await ctx.telegram.editMessageText(
            processingMsg.chat.id,
            processingMsg.message_id,
            undefined,
            successMessage,
            {
                parse_mode: "Markdown",
                link_preview_options: { is_disabled: true },
            }
        );
    } catch (error) {
        throw error;
    }
}

async function processUSDCWithdrawal(
    ctx: Context,
    user: any,
    amount: number,
    destinationAddress: string,
    processingMsg: any
): Promise<void> {
    try {
        const provider = new ethers.JsonRpcProvider(env.MAINNET_RPC_URL);
        const decryptedKey = decryptPrivateKey(user.private_key);
        const wallet = new ethers.Wallet(decryptedKey, provider);

        await updateProcessingMessage(ctx, processingMsg, "⏳ Swapping USDCe to USDC...");
        const swapResult = await executeSwapUSDCeToUSDC(amount, 0.5, wallet);

        await updateProcessingMessage(
            ctx,
            processingMsg,
            "⏳ Transferring USDC to destination address..."
        );
        const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet);
        const transferAmount = ethers.parseUnits(swapResult.amountOut, USDC_DECIMALS);
        const transferTx = await usdcContract.transfer(destinationAddress, transferAmount);
        const receipt = await transferTx.wait();

        if (!receipt?.hash) {
            throw new Error("Transfer transaction failed");
        }

        const successMessage = `✅ **Withdrawal Successful**

**Swapped:** ${amount} USDCe → ${swapResult.amountOut} USDC
**Swap TX:** \`${swapResult.transactionHash}\`
**Transfer TX:** \`${receipt.hash}\`
**To:** \`${destinationAddress}\`

[View Swap](https://polygonscan.com/tx/${swapResult.transactionHash})
[View Transfer](https://polygonscan.com/tx/${receipt.hash})`;

        await ctx.telegram.editMessageText(
            processingMsg.chat.id,
            processingMsg.message_id,
            undefined,
            successMessage,
            {
                parse_mode: "Markdown",
                link_preview_options: { is_disabled: true },
            }
        );
    } catch (error) {
        throw error;
    }
}

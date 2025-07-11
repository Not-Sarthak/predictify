import { ethers } from "ethers";
import { env } from "../../config";

interface SwapQuote {
    amountOut: string;
    amountOutFormatted: string;
    priceImpact: string;
    executionPrice: string;
    path: string;
}

interface SwapResult {
    transactionHash: string;
    amountIn: string;
    amountOut: string;
    executionPrice: string;
}

const QUOTER_V2_ADDRESS = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";
const SWAP_ROUTER_ADDRESS = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";
const POOL_FEE = 100; // 0.01% fee tier for USDC/USDCE

const QUOTER_V2_ABI = [
    "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
];

const SWAP_ROUTER_ABI = [
    "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
];

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address owner) external view returns (uint256)",
    "function decimals() external view returns (uint8)",
];

async function getProvider(): Promise<ethers.Provider> {
    return new ethers.JsonRpcProvider(env.MAINNET_RPC_URL);
}

export async function getQuote(
    inputToken: string,
    outputToken: string,
    amount: number
): Promise<SwapQuote> {
    const provider = await getProvider();
    const quoterContract = new ethers.Contract(QUOTER_V2_ADDRESS, QUOTER_V2_ABI, provider);

    const tokenInContract = new ethers.Contract(inputToken, ERC20_ABI, provider);
    const tokenOutContract = new ethers.Contract(outputToken, ERC20_ABI, provider);

    const decimalsIn = await tokenInContract.decimals();
    const decimalsOut = await tokenOutContract.decimals();

    const amountIn = ethers.parseUnits(amount.toString(), decimalsIn);

    try {
        const quoteParams = {
            tokenIn: inputToken,
            tokenOut: outputToken,
            amountIn: amountIn,
            fee: POOL_FEE,
            sqrtPriceLimitX96: 0,
        };

        const [amountOut] = await quoterContract.quoteExactInputSingle.staticCall(quoteParams);

        const amountOutFormatted = ethers.formatUnits(amountOut, decimalsOut);
        const executionPrice = (parseFloat(amountOutFormatted) / amount).toFixed(6);
        const priceImpact = ((1 - parseFloat(executionPrice)) * 100).toFixed(4);

        return {
            amountOut: amountOut.toString(),
            amountOutFormatted,
            priceImpact,
            executionPrice,
            path: `${POOL_FEE / 10000}% fee pool`,
        };
    } catch (error) {
        throw new Error(
            `Failed to get quote: ${error instanceof Error ? error.message : "Unknown error"}`
        );
    }
}

export async function executeSwap(
    inputToken: string,
    outputToken: string,
    amount: number,
    slippageTolerance: number = 0.5,
    signer: ethers.Wallet
): Promise<SwapResult> {
    const provider = await getProvider();
    const connectedSigner = signer.connect(provider);

    const tokenInContract = new ethers.Contract(inputToken, ERC20_ABI, connectedSigner);
    const swapRouter = new ethers.Contract(SWAP_ROUTER_ADDRESS, SWAP_ROUTER_ABI, connectedSigner);

    const decimalsIn = await tokenInContract.decimals();
    const amountIn = ethers.parseUnits(amount.toString(), decimalsIn);

    const quote = await getQuote(inputToken, outputToken, amount);
    const minAmountOut =
        (BigInt(quote.amountOut) * BigInt(1000 - slippageTolerance * 10)) / BigInt(1000);

    const balance = await tokenInContract.balanceOf(signer.address);
    if (balance < amountIn) {
        throw new Error(
            `Insufficient balance. Have: ${ethers.formatUnits(balance, decimalsIn)}, Need: ${amount}`
        );
    }

    const currentAllowance = await tokenInContract.allowance(signer.address, SWAP_ROUTER_ADDRESS);
    if (currentAllowance < amountIn) {
        console.log("Approving token spend...");
        const approveTx = await tokenInContract.approve(SWAP_ROUTER_ADDRESS, amountIn);
        await approveTx.wait();
        console.log("Approval confirmed");
    }

    const swapParams = {
        tokenIn: inputToken,
        tokenOut: outputToken,
        fee: POOL_FEE,
        recipient: signer.address,
        amountIn: amountIn,
        amountOutMinimum: minAmountOut,
        sqrtPriceLimitX96: 0,
    };

    console.log("Executing swap...");
    const swapTx = await swapRouter.exactInputSingle(swapParams);
    const receipt = await swapTx.wait();

    if (!receipt || receipt.status !== 1) {
        throw new Error("Swap transaction failed");
    }

    return {
        transactionHash: receipt.hash,
        amountIn: amount.toString(),
        amountOut: quote.amountOutFormatted,
        executionPrice: quote.executionPrice,
    };
}

// Example usage:
//
// import { ethers } from 'ethers';
// import { getQuote, executeSwap } from './index';
//
// // Get quote for swapping 2 USDC to USDC.e
// const quote = await getQuote(
//   '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // USDC address
//   '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC.e address
//   2
// );
// console.log('Quote:', quote);
//
// // Execute swap
// const signer = new ethers.Wallet(process.env.PRIVATE_KEY!);
// const result = await executeSwap(
//   '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // USDC address
//   '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC.e address
//   2,
//   0.5, // 0.5% slippage tolerance
//   signer
// );
// console.log('Swap result:', result);

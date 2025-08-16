import { ChainId } from "../types";
import type { deBridgeOrderInput, deBridgeOrderResponse } from "../types";
import { getBridgeQuote } from "./get-bridge-quote";
import { createDebridgeBridgeOrder } from "./create-bridge-order";
import { getSOLPriceUSD } from "../../crypto-prices";

const SOLANA_CHAIN_ID = ChainId.Solana;
const POLYGON_CHAIN_ID = ChainId.Polygon;
const SOL_TOKEN_ADDRESS = "11111111111111111111111111111111";
const POL_TOKEN_ADDRESS = "0x0000000000000000000000000000000000001010"; // POL on Polygon
const SLIPPAGE_TOLERANCE = 0.5;

/**
 * Create a bridge quote for acquiring POL tokens from SOL
 * @param params - Bridge parameters for POL acquisition
 * @returns Bridge quote response
 */
export async function getPOLBridgeQuote(params: {
    solAmount: string; // Amount in lamports
    recipientAddress: string;
    senderAddress: string;
}): Promise<deBridgeOrderResponse> {
    const bridgeParams: deBridgeOrderInput = {
        srcChainId: SOLANA_CHAIN_ID,
        srcChainTokenIn: SOL_TOKEN_ADDRESS,
        srcChainTokenInAmount: params.solAmount,
        dstChainId: POLYGON_CHAIN_ID,
        dstChainTokenOut: POL_TOKEN_ADDRESS,
        dstChainTokenOutRecipient: params.recipientAddress,
        account: params.senderAddress,
        slippage: SLIPPAGE_TOLERANCE,
    };

    return await getBridgeQuote(bridgeParams);
}

/**
 * Create a bridge order for acquiring POL tokens from SOL
 * @param params - Bridge parameters for POL acquisition
 * @returns Bridge order response with transaction data
 */
export async function createPOLBridgeOrder(params: {
    solAmount: string; // Amount in lamports
    recipientAddress: string;
    senderAddress: string;
}): Promise<deBridgeOrderResponse | null> {
    const bridgeParams: deBridgeOrderInput = {
        srcChainId: SOLANA_CHAIN_ID,
        srcChainTokenIn: SOL_TOKEN_ADDRESS,
        srcChainTokenInAmount: params.solAmount,
        dstChainId: POLYGON_CHAIN_ID,
        dstChainTokenOut: POL_TOKEN_ADDRESS,
        dstChainTokenOutRecipient: params.recipientAddress,
        account: params.senderAddress,
        slippage: SLIPPAGE_TOLERANCE,
    };

    return await createDebridgeBridgeOrder(bridgeParams);
}

/**
 * Calculate the optimal SOL amount allocation for POL and USDC bridging
 * @param totalSOLBalance - Total SOL balance available
 * @param reservedSOL - SOL to reserve for transaction fees (default 0.03)
 * @param polValueUSD - USD value to allocate for POL (default $1)
 * @returns Allocation breakdown
 */
export async function calculateBridgeAllocation(
    totalSOLBalance: number,
    reservedSOL: number = 0.03,
    polValueUSD: number = 1
): Promise<{
    totalAvailable: number;
    polAllocation: number;
    usdcAllocation: number;
    polAllocationLamports: string;
    usdcAllocationLamports: string;
    solPriceUSD: number;
}> {
    const solPriceUSD = await getSOLPriceUSD();
    const availableForBridge = Math.max(0, totalSOLBalance - reservedSOL);

    // Calculate SOL amount needed for $1 worth of POL
    const polAllocationSOL = Math.min(
        polValueUSD / solPriceUSD,
        availableForBridge * 0.1 // Max 10% for POL
    );

    const usdcAllocationSOL = availableForBridge - polAllocationSOL;

    return {
        totalAvailable: availableForBridge,
        polAllocation: polAllocationSOL,
        usdcAllocation: usdcAllocationSOL,
        polAllocationLamports: Math.floor(polAllocationSOL * 1e9).toString(),
        usdcAllocationLamports: Math.floor(usdcAllocationSOL * 1e9).toString(),
        solPriceUSD,
    };
}

/**
 * Check if POL acquisition is needed and beneficial
 * @param polBalance - Current POL balance
 * @param threshold - POL balance threshold (default 5)
 * @returns true if POL acquisition is recommended
 */
export function shouldAcquirePOL(polBalance: number, threshold: number = 5): boolean {
    return polBalance < threshold;
}

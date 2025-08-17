import { getPOLBalance } from "./get-user-balance";
import { MIN_POL_BALANCE_THRESHOLD } from "../shared/constants/polymarket";

/**
 * Check if a wallet needs POL tokens for gas fees
 * @param address - The wallet address to check
 * @returns true if POL balance is below threshold
 */
export const needsPOLForGas = async (address: string): Promise<boolean> => {
    const polBalance = await getPOLBalance(address);
    return polBalance < MIN_POL_BALANCE_THRESHOLD;
};

/**
 * Get the amount of SOL that should be allocated for POL acquisition
 * @param totalSOLAmount - Total SOL amount being bridged
 * @param polUsdValue - USD value to allocate for POL (default: $1)
 * @param solPriceUSD - Current SOL price in USD
 * @returns Amount of SOL to allocate for POL acquisition
 */
export const calculatePOLAllocation = (
    totalSOLAmount: number,
    polUsdValue: number = 1,
    solPriceUSD: number
): { polAllocation: number; usdcAllocation: number } => {
    const polAllocationInSOL = polUsdValue / solPriceUSD;
    const remainingForUSDC = totalSOLAmount - polAllocationInSOL;

    return {
        polAllocation: Math.min(polAllocationInSOL, totalSOLAmount * 0.1), // Max 10% for POL
        usdcAllocation: Math.max(remainingForUSDC, totalSOLAmount * 0.9), // Min 90% for USDC
    };
};

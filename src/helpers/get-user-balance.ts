import { ethers } from "ethers";
import { env } from "../config/env";
import { USDC_ADDRESS } from "../shared/constants";
import { Connection, clusterApiUrl, PublicKey } from "@solana/web3.js";

const USDC_ABI = ["function balanceOf(address owner) view returns (uint256)"];

export const getUserUSDCBalance = async (address: string): Promise<number> => {
    const rpcProvider = new ethers.JsonRpcProvider(env.MAINNET_RPC_URL);
    const usdcContract = new ethers.Contract(env.USDC_CONTRACT_ADDRESS, USDC_ABI, rpcProvider);
    const balance_usdc = await usdcContract.balanceOf(address);
    const balance_usdc_real = ethers.formatUnits(balance_usdc, 6);
    return parseFloat(balance_usdc_real);
};

export const getUserWrappedUSDCBalance = async (address: string): Promise<number> => {
    const rpcProvider = new ethers.JsonRpcProvider(env.MAINNET_RPC_URL);
    const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, rpcProvider);

    const balance_usdc = await usdcContract.balanceOf(address);
    const balance_usdc_real = ethers.formatUnits(balance_usdc, 6);

    return parseFloat(balance_usdc_real);
};

// getUserWrappedUSDCBalance("0xef7E2F8F5c7c8ae0Bfd1A7D55628616175BC25FB").then((result) => {
//     console.log(result);
// });

export const getSOLBalance = async (address: string): Promise<number> => {
    try {
        const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");
        const publicKey = new PublicKey(address);
        const lamports = await connection.getBalance(publicKey);
        const sol = lamports / 1e9;
        return sol;
    } catch (error) {
        console.error("Failed to Get SOL Balance:", error);
        throw error;
    }
};

export const getUserTotalBalance = async (
    evmAddress: string,
    solanaAddress?: string | null
): Promise<number> => {
    const usdcBalance = await getUserUSDCBalance(evmAddress);
    const solBalance = solanaAddress ? await getSOLBalance(solanaAddress) : 0;
    return usdcBalance + solBalance;
};

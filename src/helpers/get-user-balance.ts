import { ethers } from "ethers";
import { env } from "../config/env";
import { USDC_ADDRESS } from "../shared/constants";
import { Connection, clusterApiUrl, PublicKey } from "@solana/web3.js";

const USDC_ABI = ["function balanceOf(address owner) view returns (uint256)"];

export const getUserUSDCBalance = async (address: string): Promise<number> => {
    try {
        if (!ethers.isAddress(address)) {
            console.warn(`Invalid address format: ${address}`);
            return 0;
        }

        const rpcProvider = new ethers.JsonRpcProvider(env.MAINNET_RPC_URL);
        const usdcContract = new ethers.Contract(env.USDC_CONTRACT_ADDRESS, USDC_ABI, rpcProvider);

        const balance_usdc = await Promise.race([
            usdcContract.balanceOf(address),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("RPC call timeout")), 10000)
            ),
        ]);

        const balance_usdc_real = ethers.formatUnits(balance_usdc, 6);
        return parseFloat(balance_usdc_real);
    } catch (error) {
        console.error(`Error Fetching USDC Balance for ${address}:`, error);
        return 0;
    }
};

export const getUserWrappedUSDCBalance = async (address: string): Promise<number> => {
    try {
        if (!ethers.isAddress(address)) {
            console.warn(`Invalid address format: ${address}`);
            return 0;
        }

        const rpcProvider = new ethers.JsonRpcProvider(env.MAINNET_RPC_URL);
        const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, rpcProvider);

        const balance_usdc = await usdcContract.balanceOf(address);
        const balance_usdc_real = ethers.formatUnits(balance_usdc, 6);
        return parseFloat(balance_usdc_real);
    } catch (error) {
        console.error(`Error fetching wrapped USDC balance for ${address}:`, error);
        return 0;
    }
};

export const getSOLBalance = async (address: string): Promise<number> => {
    try {
        const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");
        const publicKey = new PublicKey(address);

        const lamports = (await Promise.race([
            connection.getBalance(publicKey),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("Solana RPC call timeout")), 10000)
            ),
        ])) as number;

        const sol = lamports / 1e9;
        return sol;
    } catch (error) {
        console.error("Failed to Get SOL Balance:", error);
        return 0;
    }
};

/**
 * Get POL (Polygon native token) balance for a given address
 * @param address - The wallet address to check
 * @returns POL balance in ether units
 */
export const getPOLBalance = async (address: string): Promise<number> => {
    try {
        if (!ethers.isAddress(address)) {
            console.warn(`Invalid address format: ${address}`);
            return 0;
        }

        const provider = new ethers.JsonRpcProvider(env.MAINNET_RPC_URL);

        const balanceInWei = await Promise.race([
            provider.getBalance(address),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("RPC call timeout")), 10000)
            ),
        ]);

        const balanceInEther = parseFloat(ethers.formatEther(balanceInWei));
        return balanceInEther;
    } catch (error) {
        console.error(`Error fetching POL balance for ${address}:`, error);
        return 0;
    }
};

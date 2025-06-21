import { ethers } from 'ethers';
import { MAINNET_RPC_URL, USDC_CONTRACT_ADDRESS } from '../config/env';
import { USDC_ADDRESS } from '../constants/polymarket';

const USDC_ABI = ["function balanceOf(address owner) view returns (uint256)"];

export const getUserUSDCBalance = async (address: string): Promise<number> => {
    const rpcProvider = new ethers.JsonRpcProvider(MAINNET_RPC_URL);
    const usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, USDC_ABI, rpcProvider);
    const balance_usdc = await usdcContract.balanceOf(address);
    const balance_usdc_real = ethers.formatUnits(balance_usdc, 6);
    return parseFloat(balance_usdc_real);
};

export const getUserWrappedUSDCBalance = async (address: string): Promise<number> => {
    const rpcProvider = new ethers.JsonRpcProvider(MAINNET_RPC_URL);
    const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, rpcProvider);
    const balance_usdc = await usdcContract.balanceOf(address);
    const balance_usdc_real = ethers.formatUnits(balance_usdc, 6);
    return parseFloat(balance_usdc_real);
};

// getUserWrappedUSDCBalance("0xef7E2F8F5c7c8ae0Bfd1A7D55628616175BC25FB").then((result) => {
//     console.log(result);
// });
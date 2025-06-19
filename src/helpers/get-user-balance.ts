import { ethers } from 'ethers';
import { RPC_URL, USDC_CONTRACT_ADDRESS } from '../config/env';

const USDC_ABI = ['function balanceOf(address owner) view returns (uint256)'];

export const getUserBalance = async (address: string): Promise<number> => {
    const rpcProvider = new ethers.JsonRpcProvider(RPC_URL);
    const usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, USDC_ABI, rpcProvider);
    const balance_usdc = await usdcContract.balanceOf(address);
    const balance_usdc_real = ethers.formatUnits(balance_usdc, 6);
    return parseFloat(balance_usdc_real);
};
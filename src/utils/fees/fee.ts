import { ethers } from "ethers";
import { TREASURY_ADDRESS, MAINNET_RPC_URL } from "../../config/env";
import { USDC_ADDRESS } from "../../constants/polymarket";
import { USDC_ABI } from "../../constants/usdc-abi";

export const FEES_PERCENTAGE = 0.01;

interface TreasuryFeeTransferParams {
    userWallet: ethers.Wallet;
    positionAmount: number;
    transactionType: "OPEN" | "CLOSE";
}

export const calculateFee = (amount: number) => {
    return amount * FEES_PERCENTAGE;
}

export const feeTransaction = (amount: number) => {
    const fee = calculateFee(amount);
    const finalAmount = amount - fee;
    return { fee, finalAmount };
}

export async function transferFeeToTreasury(params: TreasuryFeeTransferParams) {
    const { userWallet, positionAmount, transactionType } = params;
    
    try {
        const provider = new ethers.JsonRpcProvider(MAINNET_RPC_URL);
        const connectedWallet = userWallet.connect(provider);
        
        const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, connectedWallet);
        
        const feeAmount = calculateFee(positionAmount);
        const feeAmountInUnits = ethers.parseUnits(feeAmount.toString(), 6);
        
        const userBalance = await usdcContract.balanceOf(userWallet.address);
        
        if (userBalance < feeAmountInUnits) {
            throw new Error(`Insufficient USDC Balance. Required: ${feeAmount} USDC`);
        }
        
        const transferTx = await usdcContract.transfer(TREASURY_ADDRESS, feeAmountInUnits, {
            gasLimit: 200000,
            gasPrice: ethers.parseUnits("30", "gwei")
        });
        
        const receipt = await transferTx.wait();
        
        console.log(`Treasury Fee Transfer Successful:`, {
            transactionType,
            feeAmount,
            txHash: receipt.hash,
            userWallet: userWallet.address,
            treasuryAddress: TREASURY_ADDRESS
        });
        
        return {
            success: true,
            feeAmount,
            txHash: receipt.hash,
            gasUsed: receipt.gasUsed?.toString(),
            error: null
        };
        
    } catch (error) {
        console.error("Error Transferring Fee To Treasury:", error);
        return {
            success: false,
            feeAmount: calculateFee(positionAmount),
            txHash: null,
            gasUsed: null,
            error: error instanceof Error ? error.message : "Unknown Error Occurred"
        };
    }
}

export function calculateTotalCostWithFee(positionAmount: number) {
    const feeAmount = calculateFee(positionAmount);
    const totalCost = positionAmount + feeAmount;
    
    return {
        originalAmount: positionAmount,
        feeAmount,
        totalCost
    };
}

export function validateBalanceWithFee(userBalance: number, positionAmount: number): boolean {
    const { totalCost } = calculateTotalCostWithFee(positionAmount);
    return userBalance >= totalCost;
}

export async function processOrderWithTreasuryFee(params: TreasuryFeeTransferParams) {
    const { userWallet, positionAmount, transactionType } = params;
    
    const provider = new ethers.JsonRpcProvider(MAINNET_RPC_URL);
    const connectedWallet = userWallet.connect(provider);
    const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, connectedWallet);
    
    const userBalance = await usdcContract.balanceOf(userWallet.address);
    const userBalanceFormatted = parseFloat(ethers.formatUnits(userBalance, 6));
    
    const requiredBalance = transactionType === "OPEN" 
        ? calculateTotalCostWithFee(positionAmount).totalCost
        : calculateFee(positionAmount);
    
    if (!validateBalanceWithFee(userBalanceFormatted, transactionType === "OPEN" ? positionAmount : 0)) {
        return {
            success: false,
            feeAmount: calculateFee(positionAmount),
            txHash: null,
            gasUsed: null,
            error: `Insufficient Balance. Required: ${requiredBalance} USDC, Available: ${userBalanceFormatted} USDC`
        };
    }
    
    return await transferFeeToTreasury(params);
}

export type { TreasuryFeeTransferParams };
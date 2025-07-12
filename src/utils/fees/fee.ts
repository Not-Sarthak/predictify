import { ethers } from "ethers";
import { env } from "../../config/env";
import { USDC_ADDRESS } from "../../shared/constants";
import USDC_ABI from "../../shared/abi/usdc.json";
import { db } from "../../lib/supabase";

export const FEES_PERCENTAGE = 0.005;
export const REFERRAL_COMMISSION_PERCENTAGE = 0.25;

interface TreasuryFeeTransferParams {
    userWallet: ethers.Wallet;
    positionAmount: number;
    transactionType: "OPEN" | "CLOSE";
    userId: number;
}

export const calculateFee = (amount: number) => {
    return amount * FEES_PERCENTAGE;
};

export const feeTransaction = (amount: number) => {
    const fee = calculateFee(amount);
    const finalAmount = amount - fee;
    return { fee, finalAmount };
};

export async function transferFeeToTreasury(params: TreasuryFeeTransferParams) {
    const { userWallet, positionAmount, transactionType, userId } = params;

    try {
        const provider = new ethers.JsonRpcProvider(env.MAINNET_RPC_URL);
        const connectedWallet = userWallet.connect(provider);

        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice
            ? (feeData.gasPrice * 150n) / 100n
            : ethers.parseUnits("50", "gwei"); // 50% higher for speed

        const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, connectedWallet);

        const totalFeeAmount = calculateFee(positionAmount);

        const { data: userData } = await db("Users")
            .select("referred_code")
            .eq("id", userId)
            .single();

        let referrerTreasuryAddress = null;
        let referralCommission = 0;
        let mainTreasuryFee = totalFeeAmount;

        if (userData?.referred_code) {
            const { data: referrerData } = await db("Users")
                .select("treasury_wallet_address")
                .eq("referral_code", userData.referred_code)
                .single();

            if (referrerData?.treasury_wallet_address) {
                referrerTreasuryAddress = referrerData.treasury_wallet_address;
                referralCommission = totalFeeAmount * REFERRAL_COMMISSION_PERCENTAGE;
                mainTreasuryFee = totalFeeAmount - referralCommission;
            }
        }

        const userBalance = await usdcContract.balanceOf(userWallet.address);
        const totalFeeInUnits = ethers.parseUnits(totalFeeAmount.toFixed(6), 6);

        if (userBalance < totalFeeInUnits) {
            throw new Error(`Insufficient USDC Balance. Required: ${totalFeeAmount} USDC`);
        }

        const transactions = [];

        const mainTx = await usdcContract.transfer(
            env.TREASURY_ADDRESS,
            ethers.parseUnits(mainTreasuryFee.toFixed(6), 6),
            {
                gasLimit: 100000,
                gasPrice: gasPrice,
                maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
            }
        );
        transactions.push(mainTx.wait());

        if (referrerTreasuryAddress && referralCommission > 0) {
            const referralTx = await usdcContract.transfer(
                referrerTreasuryAddress,
                ethers.parseUnits(referralCommission.toFixed(6), 6),
                {
                    gasLimit: 100000,
                    gasPrice: gasPrice,
                    maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
                    nonce: (await connectedWallet.getNonce()) + 1,
                }
            );
            transactions.push(referralTx.wait());
        }

        const receipts = await Promise.all(transactions);
        const mainReceipt = receipts[0];
        const referralReceipt = receipts[1];

        console.log(`Treasury Fee Transfer Successful:`, {
            transactionType,
            mainTreasuryFee: mainTreasuryFee.toFixed(6),
            referralCommission: referralCommission.toFixed(6),
            mainTxHash: mainReceipt.hash,
            referralTxHash: referralReceipt?.hash,
            userWallet: userWallet.address,
            treasuryAddress: env.TREASURY_ADDRESS,
            referrerAddress: referrerTreasuryAddress,
        });

        return {
            success: true,
            feeAmount: totalFeeAmount,
            mainTreasuryFee,
            referralCommission,
            txHash: mainReceipt.hash,
            referralTxHash: referralReceipt?.hash,
            gasUsed: receipts.reduce((sum, r) => sum + (r?.gasUsed || 0n), 0n).toString(),
            error: null,
        };
    } catch (error) {
        console.error("Error Transferring Fee To Treasury:", error);
        return {
            success: false,
            feeAmount: calculateFee(positionAmount),
            txHash: null,
            gasUsed: null,
            error: error instanceof Error ? error.message : "Unknown Error Occurred",
        };
    }
}

export function calculateTotalCostWithFee(positionAmount: number) {
    const feeAmount = calculateFee(positionAmount);
    const totalCost = positionAmount + feeAmount;

    return {
        originalAmount: positionAmount,
        feeAmount,
        totalCost,
    };
}

export function validateBalanceWithFee(userBalance: number, positionAmount: number): boolean {
    const { totalCost } = calculateTotalCostWithFee(positionAmount);
    return userBalance >= totalCost;
}

export async function processOrderWithTreasuryFee(params: TreasuryFeeTransferParams) {
    const { userWallet, positionAmount, transactionType } = params;

    const provider = new ethers.JsonRpcProvider(env.MAINNET_RPC_URL);
    const connectedWallet = userWallet.connect(provider);
    const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, connectedWallet);

    const userBalance = await usdcContract.balanceOf(userWallet.address);
    const userBalanceFormatted = parseFloat(ethers.formatUnits(userBalance, 6));

    const requiredBalance =
        transactionType === "OPEN"
            ? calculateTotalCostWithFee(positionAmount).totalCost
            : calculateFee(positionAmount);

    if (
        !validateBalanceWithFee(
            userBalanceFormatted,
            transactionType === "OPEN" ? positionAmount : 0
        )
    ) {
        return {
            success: false,
            feeAmount: calculateFee(positionAmount),
            txHash: null,
            gasUsed: null,
            error: `Insufficient Balance. Required: ${requiredBalance} USDC, Available: ${userBalanceFormatted} USDC`,
        };
    }

    return await transferFeeToTreasury(params);
}

export type { TreasuryFeeTransferParams };

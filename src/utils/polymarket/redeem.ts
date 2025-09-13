import { Contract, ethers } from "ethers";
import { getContractConfig } from "@polymarket/clob-client";
import { env } from "../../config";
import { CHAIN_ID } from "../../shared/constants";
import { logWithBigInt } from "../bigint-serializer";

const CTF_EXCHANGE_ABI = [
    {
        inputs: [
            { internalType: "contract IERC20", name: "collateralToken", type: "address" },
            { internalType: "bytes32", name: "parentCollectionId", type: "bytes32" },
            { internalType: "bytes32", name: "conditionId", type: "bytes32" },
            { internalType: "uint256[]", name: "indexSets", type: "uint256[]" },
        ],
        name: "redeemPositions",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
];

const NEGRISK_REDEEM_ABI = [
    {
        inputs: [
            { internalType: "bytes32", name: "_conditionId", type: "bytes32" },
            { internalType: "uint256[]", name: "_amounts", type: "uint256[]" },
        ],
        name: "redeemPositions",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
];

const CTF_EXCHANGE_ADDRESS = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";
const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

// Debug function to check token balances and allowances
export async function debugNegRiskRedeem({
    privateKey,
    conditionId,
    yesAmount,
    noAmount,
}: {
    privateKey: string;
    conditionId: string;
    yesAmount: string;
    noAmount: string;
}): Promise<any> {
    try {
        const provider = new ethers.JsonRpcProvider(env.MAINNET_RPC_URL);
        const wallet = new ethers.Wallet(privateKey, provider);
        const contractConfig = getContractConfig(CHAIN_ID);

        // ERC20 ABI for balance checking
        const ERC20_ABI = [
            "function balanceOf(address owner) view returns (uint256)",
            "function allowance(address owner, address spender) view returns (uint256)",
        ];

        // CTF ABI for conditional token functions
        const CTF_ABI = [
            "function balanceOf(address owner, uint256 id) view returns (uint256)",
            "function isApprovedForAll(address owner, address operator) view returns (bool)",
        ];

        const usdcContract = new Contract(USDC_ADDRESS, ERC20_ABI, provider);
        const ctfContract = new Contract(contractConfig.conditionalTokens, CTF_ABI, provider);

        // Calculate token IDs for this condition
        const yesTokenId = ethers.solidityPackedKeccak256(["bytes32", "uint256"], [conditionId, 1]);
        const noTokenId = ethers.solidityPackedKeccak256(["bytes32", "uint256"], [conditionId, 2]);

        const debugInfo = {
            wallet: wallet.address,
            conditionId,
            yesTokenId,
            noTokenId,
            contractAddresses: {
                usdc: USDC_ADDRESS,
                conditionalTokens: contractConfig.conditionalTokens,
                negRiskExchange: contractConfig.negRiskExchange,
                negRiskAdapter: contractConfig.negRiskAdapter,
            },
            balances: {
                usdc: await usdcContract.balanceOf(wallet.address),
                yesTokens: await ctfContract.balanceOf(wallet.address, yesTokenId),
                noTokens: await ctfContract.balanceOf(wallet.address, noTokenId),
            },
            allowances: {
                usdcToNegRiskExchange: await usdcContract.allowance(
                    wallet.address,
                    contractConfig.negRiskExchange
                ),
                ctfToNegRiskExchange: await ctfContract.isApprovedForAll(
                    wallet.address,
                    contractConfig.negRiskExchange
                ),
            },
            requestedAmounts: {
                yesAmount: ethers.parseEther(yesAmount),
                noAmount: ethers.parseEther(noAmount),
            },
        };

        logWithBigInt("NegRisk Debug Info:", debugInfo);
        return debugInfo;
    } catch (error: any) {
        console.error("Debug error:", error);
        return { error: error.message || "Debug function failed" };
    }
}

export async function redeemPositions({
    privateKey,
    conditionId,
}: {
    privateKey: string;
    conditionId: string;
}): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
        const provider = new ethers.JsonRpcProvider(env.MAINNET_RPC_URL);
        const wallet = new ethers.Wallet(privateKey, provider);
        const ctfContract = new Contract(CTF_EXCHANGE_ADDRESS, CTF_EXCHANGE_ABI, wallet);

        const tx = await ctfContract.redeemPositions(
            USDC_ADDRESS,
            ethers.ZeroHash,
            conditionId,
            [1, 2]
        );

        const receipt = await tx.wait();

        return { success: true, transactionHash: receipt.hash };
    } catch (error: any) {
        console.error("Error redeeming positions:", error);
        return { success: false, error: error.message || "Failed to redeem positions" };
    }
}

export async function redeemNegRiskPositions({
    privateKey,
    conditionId,
    yesAmount,
    noAmount,
}: {
    privateKey: string;
    conditionId: string;
    yesAmount: string;
    noAmount: string;
}): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
        const provider = new ethers.JsonRpcProvider(env.MAINNET_RPC_URL);
        const wallet = new ethers.Wallet(privateKey, provider);
        const contractConfig = getContractConfig(CHAIN_ID);

        logWithBigInt("NegRisk Redeem Debug Info:", {
            wallet: wallet.address,
            conditionId,
            yesAmount,
            noAmount,
            negRiskExchange: contractConfig.negRiskExchange,
        });

        // Pre-flight validation: check actual token balances
        const debugInfo = await debugNegRiskRedeem({
            privateKey,
            conditionId,
            yesAmount,
            noAmount,
        });

        if (debugInfo.error) {
            return {
                success: false,
                error: `Pre-flight check failed: ${debugInfo.error}`,
            };
        }

        // Check if user has sufficient token balances
        const { balances, requestedAmounts } = debugInfo;

        // Only check balances for amounts > 0
        if (BigInt(requestedAmounts.yesAmount) > 0) {
            const hasYesTokens = BigInt(balances.yesTokens) >= BigInt(requestedAmounts.yesAmount);
            if (!hasYesTokens) {
                return {
                    success: false,
                    error: `Insufficient YES tokens. Have: ${ethers.formatEther(balances.yesTokens)}, Need: ${yesAmount}`,
                };
            }
        }

        if (BigInt(requestedAmounts.noAmount) > 0) {
            const hasNoTokens = BigInt(balances.noTokens) >= BigInt(requestedAmounts.noAmount);
            if (!hasNoTokens) {
                return {
                    success: false,
                    error: `Insufficient NO tokens. Have: ${ethers.formatEther(balances.noTokens)}, Need: ${noAmount}`,
                };
            }
        }

        if (!debugInfo.allowances.ctfToNegRiskExchange) {
            return {
                success: false,
                error: "Conditional tokens not approved for NegRisk Exchange. Please set allowances first.",
            };
        }

        // Use the NegRisk exchange contract for NegRisk markets
        const negRiskContract = new Contract(
            contractConfig.negRiskAdapter,
            NEGRISK_REDEEM_ABI,
            wallet
        );

        // Parse amounts to wei
        const yesAmountWei = ethers.parseUnits(yesAmount, 18);
        const noAmountWei = ethers.parseUnits(noAmount, 18);

        // Only include non-zero amounts in the redeem call
        // If both amounts are > 0, redeem both; otherwise redeem only the non-zero one
        let amounts;
        if (yesAmountWei > 0 && noAmountWei > 0) {
            amounts = [yesAmountWei, noAmountWei];
        } else if (yesAmountWei > 0) {
            amounts = [yesAmountWei, 0n];
        } else if (noAmountWei > 0) {
            amounts = [0n, noAmountWei];
        } else {
            return {
                success: false,
                error: "No tokens to redeem - both amounts are 0",
            };
        }

        console.log(
            "Redeem amounts (Wei):",
            amounts.map((a) => a.toString())
        );

        const gasEstimate = await negRiskContract.redeemPositions.estimateGas(conditionId, amounts);

        const tx = await negRiskContract.redeemPositions(conditionId, amounts, {
            gasLimit: (gasEstimate * 120n) / 100n, // +20% buffer
            gasPrice: ethers.parseUnits("100", "gwei"),
        });

        console.log("Transaction sent:", tx.hash);
        const receipt = await tx.wait();

        return { success: true, transactionHash: receipt.hash };
    } catch (error: any) {
        console.error("Error redeeming NegRisk positions:", error);
        let errorMessage = error.message || "Failed to redeem NegRisk positions";

        // Provide more specific error messages based on error type
        if (error.reason) {
            errorMessage = `Contract error: ${error.reason}`;
        } else if (error.code === "CALL_EXCEPTION") {
            errorMessage = "Transaction would fail - check token balances and market status";
        } else if (error.message?.includes("insufficient")) {
            errorMessage = "Insufficient token balance or allowances not set";
        } else if (error.message?.includes("gas")) {
            errorMessage = "Gas estimation failed - transaction may not be valid";
        }

        return { success: false, error: errorMessage };
    }
}

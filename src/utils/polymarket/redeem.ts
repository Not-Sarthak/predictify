import { Contract, ethers } from "ethers";
import { getContractConfig } from "@polymarket/clob-client";
import { env } from "../../config";
import { CHAIN_ID } from "../../shared/constants";

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

// ABI for NegRisk redemption - includes amounts parameter for binary outcomes
const NEGRISK_REDEEM_ABI = [
    {
        inputs: [
            { internalType: "contract IERC20", name: "collateralToken", type: "address" },
            { internalType: "bytes32", name: "parentCollectionId", type: "bytes32" },
            { internalType: "bytes32", name: "conditionId", type: "bytes32" },
            { internalType: "uint256[]", name: "indexSets", type: "uint256[]" },
            { internalType: "uint256[]", name: "amounts", type: "uint256[]" },
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

        console.log("NegRisk Debug Info:", JSON.stringify(debugInfo, null, 2));
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
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            conditionId,
            [1, 2]
        );

        const receipt = await tx.wait();

        return {
            success: true,
            transactionHash: receipt.hash,
        };
    } catch (error: any) {
        console.error("Error redeeming positions:", error);
        return {
            success: false,
            error: error.message || "Failed to redeem positions",
        };
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

        console.log("NegRisk Redeem Debug Info:", {
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
        const hasYesTokens = BigInt(balances.yesTokens) >= BigInt(requestedAmounts.yesAmount);
        const hasNoTokens = BigInt(balances.noTokens) >= BigInt(requestedAmounts.noAmount);

        if (!hasYesTokens && requestedAmounts.yesAmount > 0) {
            return {
                success: false,
                error: `Insufficient YES tokens. Have: ${ethers.formatEther(balances.yesTokens)}, Need: ${yesAmount}`,
            };
        }

        if (!hasNoTokens && requestedAmounts.noAmount > 0) {
            return {
                success: false,
                error: `Insufficient NO tokens. Have: ${ethers.formatEther(balances.noTokens)}, Need: ${noAmount}`,
            };
        }

        if (!debugInfo.allowances.ctfToNegRiskExchange) {
            return {
                success: false,
                error: "Conditional tokens not approved for NegRisk Exchange. Please set allowances first.",
            };
        }

        // Use the NegRisk exchange contract for NegRisk markets
        const negRiskContract = new Contract(
            contractConfig.negRiskExchange,
            NEGRISK_REDEEM_ABI,
            wallet
        );

        // amounts of conditional tokens to redeem. Only used for neg risk redeems
        // should always have length 2, with the first element being the amount of yes tokens to redeem and the
        // second element being the amount of no tokens to redeem
        // Only necessary for redeeming neg risk tokens

        // Conditional tokens typically use 18 decimals (Wei)
        // But let's also try with 6 decimals (USDC-like) as a fallback
        const amounts = [
            ethers.parseUnits(yesAmount, 18), // Yes token amount (18 decimals)
            ethers.parseUnits(noAmount, 18), // No token amount (18 decimals)
        ];

        console.log(
            "Redeem amounts (Wei):",
            amounts.map((a) => a.toString())
        );

        // First try to estimate gas to catch errors early
        const gasEstimate = await negRiskContract.redeemPositions.estimateGas(
            USDC_ADDRESS,
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            conditionId,
            [1, 2], // indexSets for yes/no outcomes
            amounts
        );

        console.log("Gas estimate:", gasEstimate.toString());

        const tx = await negRiskContract.redeemPositions(
            USDC_ADDRESS,
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            conditionId,
            [1, 2], // indexSets for yes/no outcomes
            amounts,
            {
                gasLimit: (gasEstimate * 120n) / 100n, // Add 20% buffer
                gasPrice: ethers.parseUnits("100", "gwei"),
            }
        );

        console.log("Transaction sent:", tx.hash);
        const receipt = await tx.wait();

        return {
            success: true,
            transactionHash: receipt.hash,
        };
    } catch (error: any) {
        console.error("Error redeeming NegRisk positions:", error);

        // Extract more detailed error information
        let errorMessage = error.message || "Failed to redeem NegRisk positions";

        if (error.reason) {
            errorMessage = `Contract error: ${error.reason}`;
        } else if (error.code === "CALL_EXCEPTION") {
            errorMessage = "Transaction would fail - check token balances and market status";
        }

        return {
            success: false,
            error: errorMessage,
        };
    }
}

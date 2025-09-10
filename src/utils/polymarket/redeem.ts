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
        const amounts = [
            ethers.parseUnits(yesAmount, 6), // Yes token amount
            ethers.parseUnits(noAmount, 6), // No token amount
        ];

        const tx = await negRiskContract.redeemPositions(
            USDC_ADDRESS,
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            conditionId,
            [1, 2], // indexSets for yes/no outcomes
            amounts
        );

        const receipt = await tx.wait();

        return {
            success: true,
            transactionHash: receipt.hash,
        };
    } catch (error: any) {
        console.error("Error redeeming NegRisk positions:", error);
        return {
            success: false,
            error: error.message || "Failed to redeem NegRisk positions",
        };
    }
}

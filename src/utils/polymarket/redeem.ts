import { Contract, ethers } from "ethers";
import { env } from "../../config";
import type { ApiKeyCreds } from "../../types/polymarket";
import { ClobClient } from "@polymarket/clob-client";

const CTF_EXCHANGE_ABI = [
    {
        inputs: [
            { internalType: "bytes32", name: "conditionId", type: "bytes32" },
            { internalType: "uint256", name: "indexSet", type: "uint256" },
        ],
        name: "payoutNumerators",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            { internalType: "contract IERC20", name: "collateralToken", type: "address" },
            { internalType: "bytes32", name: "parentCollectionId", type: "bytes32" },
            { internalType: "bytes32", name: "conditionId", type: "bytes32" },
            { internalType: "uint256[]", name: "indexSets", type: "uint256[]" },
            { internalType: "uint256", name: "amount", type: "uint256" },
        ],
        name: "redeemPositions",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
];

const CTF_EXCHANGE_ADDRESS = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";
const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

export async function isMarketResolved(conditionId: string, privateKey: string): Promise<boolean> {
    try {
        const provider = new ethers.JsonRpcProvider(env.POLYGON_RPC_URL);
        const wallet = new ethers.Wallet(privateKey, provider);
        const ctfContract = new Contract(CTF_EXCHANGE_ADDRESS, CTF_EXCHANGE_ABI, wallet);

        const payoutNumerators = await ctfContract.payoutNumerators(conditionId, 0);
        return payoutNumerators > 0n;
    } catch (error) {
        console.error("Error checking market resolution:", error);
        return false;
    }
}

export async function redeemPositions({
    privateKey,
    conditionId,
    amount,
    creds,
}: {
    privateKey: string;
    conditionId: string;
    amount: number;
    creds: ApiKeyCreds;
}): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
        const provider = new ethers.JsonRpcProvider(env.POLYGON_RPC_URL);
        const wallet = new ethers.Wallet(privateKey, provider);
        const ctfContract = new Contract(CTF_EXCHANGE_ADDRESS, CTF_EXCHANGE_ABI, wallet);

        const isResolved = await isMarketResolved(conditionId, privateKey);
        if (!isResolved) {
            return { success: false, error: "Market not resolved yet" };
        }

        const amountInWei = ethers.parseUnits(amount.toString(), 6);

        const tx = await ctfContract.redeemPositions(
            USDC_ADDRESS,
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            conditionId,
            [1, 2],
            amountInWei
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

export async function getRedeemableAmount({
    privateKey,
    conditionId,
    userAddress,
    creds,
}: {
    privateKey: string;
    conditionId: string;
    userAddress: string;
    creds: ApiKeyCreds;
}): Promise<{ yesAmount: number; noAmount: number; totalUSDC: number }> {
    try {
        const clobClient = new ClobClient(
            env.POLYMARKET_ENDPOINT,
            137,
            new ethers.Wallet(privateKey) as any,
            creds
        );

        const balances = await clobClient.getBalances();

        const yesAmount = 0;
        const noAmount = 0;

        const isResolved = await isMarketResolved(conditionId, privateKey);
        if (!isResolved) {
            return { yesAmount: 0, noAmount: 0, totalUSDC: 0 };
        }

        const provider = new ethers.JsonRpcProvider(env.POLYGON_RPC_URL);
        const wallet = new ethers.Wallet(privateKey, provider);
        const ctfContract = new Contract(CTF_EXCHANGE_ADDRESS, CTF_EXCHANGE_ABI, wallet);

        const yesPayoutNumerator = await ctfContract.payoutNumerators(conditionId, 1);
        const noPayoutNumerator = await ctfContract.payoutNumerators(conditionId, 2);

        let totalUSDC = 0;
        if (yesPayoutNumerator > 0n) {
            totalUSDC = yesAmount;
        } else if (noPayoutNumerator > 0n) {
            totalUSDC = noAmount;
        }

        return { yesAmount, noAmount, totalUSDC };
    } catch (error) {
        console.error("Error getting redeemable amount:", error);
        return { yesAmount: 0, noAmount: 0, totalUSDC: 0 };
    }
}

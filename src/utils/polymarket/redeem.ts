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
const NEGRISK_ADAPTER_ADDRESS = "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296";

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
    asset,
    oppositeAsset,
    outcomeIndex,
}: {
    privateKey: string;
    conditionId: string;
    asset: string;
    oppositeAsset: string;
    outcomeIndex: number;
}): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    console.log("----- NEGRISK REDEEM PARAMETERS -----");
    console.log("CONDITION ID: ", conditionId);
    console.log("ASSET: ", asset);
    console.log("OPPOSITE ASSET: ", oppositeAsset);
    console.log("OUTCOME INDEX: ", outcomeIndex);

    try {
        const provider = new ethers.JsonRpcProvider(env.MAINNET_RPC_URL);
        const wallet = new ethers.Wallet(privateKey, provider);
        const negRiskContract = new Contract(NEGRISK_ADAPTER_ADDRESS, NEGRISK_REDEEM_ABI, wallet);

        const assetBalance: bigint = await negRiskContract.balanceOf(wallet.address, asset);
        const oppositeAssetBalance: bigint = await negRiskContract.balanceOf(
            wallet.address,
            oppositeAsset
        );

        console.log("YES BALANCE: ", assetBalance);
        console.log("NO BALANCE: ", oppositeAssetBalance);

        if (assetBalance === 0n && oppositeAssetBalance === 0n) {
            return { success: false, error: "No redeemable NegRisk positions found" };
        }

        const amounts = outcomeIndex
            ? [oppositeAssetBalance, assetBalance]
            : [assetBalance, oppositeAssetBalance];

        console.log("AMOUNTS: ", amounts);

        const tx = await negRiskContract.redeemPositions(conditionId, amounts);

        console.log("Transaction: ", tx);
        console.log("[NEGRISK REDEEM] Transaction Hash:", tx.hash);

        const receipt = await tx.wait();

        return { success: true, transactionHash: receipt.hash };
    } catch (error: any) {
        console.error("Error redeeming NegRisk positions:", error);
        let errorMessage = error.message || "Failed to redeem NegRisk positions";

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

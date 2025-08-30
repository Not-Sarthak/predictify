import { Contract, ethers } from "ethers";
import { env } from "../../config";

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

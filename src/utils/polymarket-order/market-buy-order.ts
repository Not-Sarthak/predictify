import { type ApiKeyCreds, ClobClient, OrderType, Side } from "@polymarket/clob-client";
import { ethers, Contract, Wallet, getAddress, JsonRpcProvider } from "ethers";
import { CHAIN_ID } from "../../shared/constants/polymarket";
import { env } from "../../config/env";
import { createLegacyWallet } from "../../utils";
import { getUserWrappedUSDCBalance } from "../../helpers/get-user-balance";
import { setUSDCAllowance } from "../polymarket/set-allowance";
import { setNegativeRiskAllowance } from "../../utils/polymarket/set-negative-risk-allowance";

interface MarketBuyOrderRequest {
    privateKey: string;
    creds: ApiKeyCreds;
    tokenId: string;
    amount: number;
    side: Side;
    orderType: OrderType.FOK | OrderType.FAK; // OrderType.FOK or OrderType.FAK
}

interface MarketSellOrderRequest {
    privateKey: string;
    creds: ApiKeyCreds;
    tokenId: string;
    amount: number; // number of outcome shares to sell
    orderType: OrderType.FOK | OrderType.FAK;
}

const provider = new JsonRpcProvider(env.MAINNET_RPC_URL);
const CONDITIONAL_TOKENS_ADDRESS = getAddress("0x4D97DCd97eC945f40cF65F87097ACe5EA0476045");
const CLOB_EXCHANGE_ADDRESS = getAddress("0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E");
const CONDITIONAL_TOKENS_ABI = [
    "function isApprovedForAll(address owner, address operator) view returns (bool)",
    "function setApprovalForAll(address operator, bool approved) external",
];

export async function ensureTokenApproval(privateKey: string): Promise<void> {
    const wallet = new Wallet(privateKey, provider);

    const tokenContract = new Contract(CONDITIONAL_TOKENS_ADDRESS, CONDITIONAL_TOKENS_ABI, wallet);

    try {
        const isApproved = await tokenContract.isApprovedForAll(
            wallet.address,
            CLOB_EXCHANGE_ADDRESS
        );

        if (!isApproved) {
            const tx = await tokenContract.setApprovalForAll(CLOB_EXCHANGE_ADDRESS, true);
            await tx.wait();
        }
    } catch (err) {
        console.error("Approval Check Failed:", err);
    }
}

export async function marketBuyOrder(marketBuyOrderRequest: MarketBuyOrderRequest) {
    const wallet = new ethers.Wallet(marketBuyOrderRequest.privateKey);
    const chainId = CHAIN_ID;
    const host = env.CLOB_API_URL;
    const creds: ApiKeyCreds = marketBuyOrderRequest.creds;
    const clobClient = new ClobClient(host, chainId, createLegacyWallet(wallet) as any, creds);

    const balance = await getUserWrappedUSDCBalance(wallet.address);
    const totalCost = marketBuyOrderRequest.amount;

    let txHash;

    if (balance < totalCost) {
        return {
            response: null,
            error: `You have Insufficient Wrapped USDC Balance.\n\nRequired: ${totalCost.toString()} USDC\nAvailable: ${balance.toLocaleString()} USDC`,
        };
    }

    try {
        txHash = await setUSDCAllowance(wallet);
    } catch (error) {
        console.error("Error Setting USDC Allowance: ", error);
        return {
            response: null,
            error: "Error setting USDC Allowance",
        };
    }

    await setNegativeRiskAllowance(marketBuyOrderRequest.privateKey);

    try {
        const roundedAmount = parseFloat(marketBuyOrderRequest.amount.toFixed(6));

        const marketBuyOrder = await clobClient.createMarketOrder({
            tokenID: marketBuyOrderRequest.tokenId,
            amount: roundedAmount,
            side: marketBuyOrderRequest.side,
            orderType: marketBuyOrderRequest.orderType,
        });

        const response = await clobClient.postOrder(
            marketBuyOrder,
            marketBuyOrderRequest.orderType
        );

        if (response.error) {
            throw new Error(response.error);
        }

        return { response, tx: txHash, error: null };
    } catch (error) {
        console.error("Error Placing Order:", error);
        return { response: null, error };
    }
}

export async function marketSellOrder(request: MarketSellOrderRequest) {
    const wallet = new ethers.Wallet(request.privateKey);
    const chainId = CHAIN_ID;
    const host = env.CLOB_API_URL;
    const creds = request.creds;
    const clobClient = new ClobClient(host, chainId, createLegacyWallet(wallet) as any, creds);

    try {
        await ensureTokenApproval(request.privateKey);

        const roundedAmount = parseFloat(request.amount.toFixed(6));

        const marketSellOrder = await clobClient.createMarketOrder({
            tokenID: request.tokenId,
            amount: roundedAmount,
            side: Side.SELL,
            orderType: request.orderType,
        });

        const response = await clobClient.postOrder(marketSellOrder, request.orderType);

        if (response.error) {
            throw new Error(response.error);
        }

        return { response, error: null };
    } catch (error) {
        console.error("Error Placing Sell Order:", error);
        return { response: null, error };
    }
}

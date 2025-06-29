import { type ApiKeyCreds, ClobClient, OrderType, Side } from "@polymarket/clob-client";
import { ethers } from "ethers";
import { CHAIN_ID } from "../../shared/constants/polymarket";
import { env } from "../../config/env";
import { createLegacyWallet } from "../../shared/utils";
import { getUserWrappedUSDCBalance } from "../../helpers/get-user-balance";
import { setUSDCAllowance } from "../polymarket/set-allowance";

interface MarketBuyOrderRequest {
    privateKey: string;
    creds: ApiKeyCreds;
    tokenId: string;
    amount: number;
    side: Side;
    orderType: OrderType.FOK | OrderType.FAK; // OrderType.FOK or OrderType.FAK
}

// FOK: Fill Or Kill -> Must Fill the ENTIRE Order Immediately or Cancel Completely
// FAK: Fill And Kill -> Fill whatever Portion is Available Immediately, then Cancel the Rest.
export async function marketBuyOrder(marketBuyOrderRequest: MarketBuyOrderRequest) {
    const wallet = new ethers.Wallet(marketBuyOrderRequest.privateKey);
    const chainId = CHAIN_ID;
    const host = env.CLOB_API_URL;
    const creds: ApiKeyCreds = marketBuyOrderRequest.creds;
    const clobClient = new ClobClient(host, chainId, createLegacyWallet(wallet) as any, creds);

    const balance = await getUserWrappedUSDCBalance(wallet.address);
    const totalCost = marketBuyOrderRequest.amount;

    if (balance < totalCost) {
        return {
            response: null,
            error: `You have Insufficient Wrapped USDC Balance.\n\nRequired: ${totalCost.toString()} USDC\nAvailable: ${balance.toLocaleString()} USDC`,
        };
    }

    try {
        await setUSDCAllowance(wallet, totalCost.toString());
    } catch (error) {
        console.error("Error setting USDC Allowance: ", error);
        return {
            response: null,
            error: "Error setting USDC Allowance",
        };
    }

    try {
        const marketBuyOrder = await clobClient.createMarketOrder({
            tokenID: marketBuyOrderRequest.tokenId,
            amount: marketBuyOrderRequest.amount,
            side: marketBuyOrderRequest.side,
            orderType: marketBuyOrderRequest.orderType,
        });

        const response = await clobClient.postOrder(marketBuyOrder, OrderType.FOK);

        if (response.error) {
            throw new Error(response.error);
        }

        return { response, error: null };
    } catch (error) {
        console.error("Error placing Order: ", error);
        return { response: null, error };
    }

    // const resp2 = await clobClient.createAndPostMarketOrder(
    //     {
    //         tokenID: marketBuyOrderRequest.tokenId,
    //         amount: marketBuyOrderRequest.amount,
    //         side: marketBuyOrderRequest.side,
    //         orderType: marketBuyOrderRequest.orderType,
    //     },
    //     { tickSize: "0.01" },
    //     OrderType.FOK, // or FAK
    // );
}

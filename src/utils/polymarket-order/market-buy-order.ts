import { type ApiKeyCreds, ClobClient, OrderType, Side } from "@polymarket/clob-client";
import { ethers } from "ethers";
import { CHAIN_ID } from "../../constants/polymarket";
import { CLOB_API_URL } from "../../config/env";
import { createLegacyWallet } from "../../constants/legacy-ethers";

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
    const host = CLOB_API_URL;
    const creds: ApiKeyCreds = marketBuyOrderRequest.creds;
    const clobClient = new ClobClient(host, chainId, createLegacyWallet(wallet) as any, creds);
    
    const marketBuyOrder = await clobClient.createMarketOrder({
        tokenID: marketBuyOrderRequest.tokenId,
        amount: marketBuyOrderRequest.amount,
        side: marketBuyOrderRequest.side,
        orderType: marketBuyOrderRequest.orderType,
    });

    const response = await clobClient.postOrder(marketBuyOrder, OrderType.FOK);
    return response;

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

import { ethers } from "ethers";
import { env } from "../../config/env";
import { ClobClient, type ApiKeyCreds } from "@polymarket/clob-client";
import { CHAIN_ID } from "@/shared/constants";
import { createLegacyWallet } from "@/utils";

interface CancelOrderRequest {
    privateKey: string;
    orderIds: string[];
    creds: ApiKeyCreds;
}

export const cancelOrder = async (cancelOrderRequest: CancelOrderRequest) => {
    const wallet = new ethers.Wallet(cancelOrderRequest.privateKey);
    const host = env.CLOB_API_URL;

    const clobClient = new ClobClient(
        host,
        CHAIN_ID,
        createLegacyWallet(wallet) as any,
        cancelOrderRequest.creds
    );

    const response = await clobClient.cancelOrders(cancelOrderRequest.orderIds);
    return response;
};

import { ethers } from "ethers";
import { env } from "../../config/env";
import { CHAIN_ID } from "../../shared/constants";
import { ClobClient, type ApiKeyCreds, type BookParams } from "@polymarket/clob-client";
import { createLegacyWallet } from "../../shared/utils";

interface GetLastTradePriceRequest {
    tokenId: BookParams[];
    creds: ApiKeyCreds;
}

export async function getLastTradePrice(getLastTradePriceRequest: GetLastTradePriceRequest) {
    const wallet = new ethers.Wallet(env.PRIVATE_KEY);
    const chainId = CHAIN_ID;

    const host = env.CLOB_API_URL;
    const clobClient = new ClobClient(
        host,
        chainId,
        createLegacyWallet(wallet) as any,
        getLastTradePriceRequest.creds
    );

    const response = await clobClient.getLastTradesPrices(getLastTradePriceRequest.tokenId);
    return response;
}

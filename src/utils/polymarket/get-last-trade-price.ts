import { ethers } from "ethers";
import { CLOB_API_URL, PRIVATE_KEY } from "../../config/env";
import { CHAIN_ID } from "../../constants/polymarket";
import {
  ClobClient,
  type ApiKeyCreds,
  type BookParams,
} from "@polymarket/clob-client";
import { createLegacyWallet } from "../../constants/legacy-ethers";

interface GetLastTradePriceRequest {
  tokenId: BookParams[];
  creds: ApiKeyCreds;
}

export async function getLastTradePrice(
  getLastTradePriceRequest: GetLastTradePriceRequest
) {
  const wallet = new ethers.Wallet(PRIVATE_KEY);
  const chainId = CHAIN_ID;

  const host = CLOB_API_URL;
  const clobClient = new ClobClient(
    host,
    chainId,
    createLegacyWallet(wallet) as any,
    getLastTradePriceRequest.creds
  );

  const response = await clobClient.getLastTradesPrices(
    getLastTradePriceRequest.tokenId
  );
  return response;
}

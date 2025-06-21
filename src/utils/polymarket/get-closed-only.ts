import { ethers } from "ethers";
import { type ApiKeyCreds, ClobClient } from "@polymarket/clob-client";
import { CLOB_API_URL, PRIVATE_KEY } from "../../config/env";
import { CHAIN_ID } from "../../constants/polymarket";
import { createLegacyWallet } from "../../constants/legacy-ethers";

export async function getClosedOnlyMode(creds: ApiKeyCreds) {
  const wallet = new ethers.Wallet(PRIVATE_KEY);
  const chainId = CHAIN_ID;
  console.log(`Address: ${await wallet.getAddress()}, chainId: ${chainId}`);

  const host = CLOB_API_URL;
  const clobClient = new ClobClient(
    host,
    chainId,
    createLegacyWallet(wallet) as any,
    creds
  );
  const response = await clobClient.getClosedOnlyMode();
  console.log(response);
  return response;
}

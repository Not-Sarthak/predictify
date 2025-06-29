import { ethers } from "ethers";
import { type ApiKeyCreds, ClobClient } from "@polymarket/clob-client";
import { env } from "../../config/env";
import { CHAIN_ID } from "../../shared/constants";
import { createLegacyWallet } from "../../shared/utils";

export async function getClosedOnlyMode(creds: ApiKeyCreds) {
    const wallet = new ethers.Wallet(env.PRIVATE_KEY);
    const chainId = CHAIN_ID;
    console.log(`Address: ${await wallet.getAddress()}, chainId: ${chainId}`);

    const host = env.CLOB_API_URL;
    const clobClient = new ClobClient(host, chainId, createLegacyWallet(wallet) as any, creds);
    const response = await clobClient.getClosedOnlyMode();
    console.log(response);
    return response;
}

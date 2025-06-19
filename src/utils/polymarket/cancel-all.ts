import { type ApiKeyCreds, ClobClient } from "@polymarket/clob-client";
import { getWallet } from "../../helpers/get-wallet-address";
import { CLOB_API_URL } from "../../config/env";
import { createLegacyWallet } from "../../constants/legacy-ethers";

interface CancelAllProps {
    mainnet: boolean;
    apiKey: string;
    secret: string;
    passphrase: string;
}

export async function cancelAll({ mainnet, apiKey, secret, passphrase }: CancelAllProps) {
    const wallet = getWallet(mainnet);
    const chainId = mainnet ? 137 : 80002;

    const host = CLOB_API_URL;
    const creds: ApiKeyCreds = {
        key: apiKey,
        secret,
        passphrase,
    };

    const legacyWallet = createLegacyWallet(wallet);
    const clobClient = new ClobClient(host, chainId, legacyWallet as any, creds);

    const resp = await clobClient.cancelAll();
    console.log(resp);
    console.log(`Done!`);
}

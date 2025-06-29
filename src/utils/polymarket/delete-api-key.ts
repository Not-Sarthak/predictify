import { type ApiKeyCreds, ClobClient } from "@polymarket/clob-client";
import { createLegacyWallet } from "../../shared/utils";
import { getWallet } from "../../helpers/get-wallet-address";
import { env } from "../../config/env";

interface DeleteApiKeyProps {
    mainnet: boolean;
    apiKey: string;
    secret: string;
    passphrase: string;
}

export async function deleteApiKey({ mainnet, apiKey, secret, passphrase }: DeleteApiKeyProps) {
    const wallet = getWallet(mainnet);
    const chainId = mainnet ? 137 : 80002;
    console.log(`Address: ${await wallet.getAddress()}, chainId: ${chainId}`);

    const host = env.CLOB_API_URL;
    const creds: ApiKeyCreds = {
        key: apiKey,
        secret,
        passphrase,
    };

    const legacyWallet = createLegacyWallet(wallet);
    const clobClient = new ClobClient(host, chainId, legacyWallet as any, creds);

    console.log(`Response: `);
    const resp = await clobClient.deleteApiKey();
    console.log(resp);
    console.log(`Complete!`);
}

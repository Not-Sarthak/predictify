import { ClobClient } from "@polymarket/clob-client";
import type { APIKeyRequest, GeneratedWallet } from "../../shared/types/polymarket/api-key";
import { Wallet, JsonRpcProvider } from "ethers";
import { Keypair } from "@solana/web3.js";

export async function generateAPIKeyAndWallet(request: APIKeyRequest): Promise<GeneratedWallet> {
    const provider = new JsonRpcProvider(request.host);

    const wallet = Wallet.createRandom().connect(provider);

    const walletWithLegacyMethods = {
        ...wallet,
        _signTypedData: async (domain: any, types: any, value: any) => {
            const { EIP712Domain, ...typesWithoutDomain } = types;
            return await wallet.signTypedData(domain, typesWithoutDomain, value);
        },
        getAddress: async () => wallet.address,
        signMessage: async (message: string) => wallet.signMessage(message),
        provider: provider,
    };

    const solanaKeypair = Keypair.generate();
    const solanaAddress = solanaKeypair.publicKey.toString();
    const solanaPrivateKey = Buffer.from(solanaKeypair.secretKey).toString("base64");

    const client = new ClobClient(request.host, request.chainId, walletWithLegacyMethods as any);

    try {
        const apiCreds = await client.createOrDeriveApiKey();

        console.log("Generated Ethereum Wallet Address:", wallet.address);
        console.log("Generated Ethereum Private Key:", wallet.privateKey);
        console.log("Generated Solana Wallet Address:", solanaAddress);
        console.log("Generated Solana Private Key:", solanaPrivateKey);
        console.log("API Credentials:", apiCreds);

        return {
            address: wallet.address,
            privateKey: wallet.privateKey,
            apiCreds: apiCreds,
            solanaAddress: solanaAddress,
            solanaPrivateKey: solanaPrivateKey,
        };
    } catch (error) {
        console.error("Error:", error);
        throw error;
    }
}

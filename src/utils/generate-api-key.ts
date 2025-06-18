import { ClobClient } from "@polymarket/clob-client"
import type { APIKeyRequest } from "../types/api-key"
import { Wallet, JsonRpcProvider } from "ethers"

export async function generateAPIKey(request: APIKeyRequest) {
    const provider = new JsonRpcProvider(request.host)
    const wallet = new Wallet(request.privateKey).connect(provider)

    const walletWithLegacyMethods = {
        ...wallet,
        _signTypedData: async (domain: any, types: any, value: any) => {
            const { EIP712Domain, ...typesWithoutDomain } = types;
            return await wallet.signTypedData(domain, typesWithoutDomain, value);
        },
        getAddress: async () => wallet.address,
        signMessage: async (message: string) => wallet.signMessage(message),
        provider: provider
    }

    const client = new ClobClient(request.host, request.chainId, walletWithLegacyMethods as any)

    try {
        const apiKey = await client.deriveApiKey();
        console.log('API Key:', apiKey);
        return apiKey;
    } catch (error) {
        console.error('Error:', error)
        throw error
    }
}
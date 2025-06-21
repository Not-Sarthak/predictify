import { ClobClient } from "@polymarket/clob-client"
import type { APIKeyRequest, GeneratedWallet } from "../../types/api-key"
import { Wallet, JsonRpcProvider } from "ethers"

export async function generateAPIKeyAndWallet(request: APIKeyRequest): Promise<GeneratedWallet> {
    const provider = new JsonRpcProvider(request.host)
    
    const wallet = Wallet.createRandom().connect(provider)

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
        const apiCreds = await client.createOrDeriveApiKey();

        console.log('Generated Wallet Address:', wallet.address);
        console.log('Generated Private Key:', wallet.privateKey);
        console.log('API Credentials:', apiCreds);
        
        return {
            address: wallet.address,
            privateKey: wallet.privateKey,
            apiCreds: apiCreds
        };
    } catch (error) {
        console.error('Error:', error)
        throw error
    }
}
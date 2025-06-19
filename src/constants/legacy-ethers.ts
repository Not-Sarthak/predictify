import { ethers } from "ethers";

export function createLegacyWallet(wallet: ethers.Wallet) {
    return {
        ...wallet,
        _signTypedData: async (domain: any, types: any, value: any) => {
            const { EIP712Domain, ...typesWithoutDomain } = types;
            return await wallet.signTypedData(domain, typesWithoutDomain, value);
        },
        getAddress: async () => wallet.address,
        signMessage: async (message: string) => wallet.signMessage(message),
        provider: wallet.provider
    };
}
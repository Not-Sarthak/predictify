export type APIKeyRequest = {
    host: string;
    chainId: number;
};

export type ApiKeyCreds = {
    key: string;
    secret: string;
    passphrase: string;
};

export type GeneratedWallet = {
    address: string;
    privateKey: string;
    solanaAddress: string;
    solanaPrivateKey: string;
    apiCreds: ApiKeyCreds;
};

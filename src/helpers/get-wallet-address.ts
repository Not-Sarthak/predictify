import { ethers } from "ethers";
import { env } from "../config/env";

export function getWallet(mainnet: boolean): ethers.Wallet {
    let rpcUrl = "";
    if (mainnet) {
        rpcUrl = env.MAINNET_RPC_URL;
    } else {
        rpcUrl = env.TESTNET_RPC_URL;
    }
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    return new ethers.Wallet(env.PRIVATE_KEY, provider);
}

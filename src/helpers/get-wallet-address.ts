import { ethers } from "ethers";
import { PRIVATE_KEY, MAINNET_RPC_URL, TESTNET_RPC_URL } from "../config/env";

export function getWallet(mainnet: boolean): ethers.Wallet {
  let rpcUrl = "";
  if (mainnet) {
    rpcUrl = MAINNET_RPC_URL;
  } else {
    rpcUrl = TESTNET_RPC_URL;
  }
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  return new ethers.Wallet(PRIVATE_KEY, provider);
}   

// const wallet = getWallet(true);
// console.log(wallet.address);
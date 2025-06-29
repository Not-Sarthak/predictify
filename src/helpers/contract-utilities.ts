import { getContractConfig } from "@polymarket/clob-client";
import { ethers } from "ethers";
import CTF_ABI from "../shared/abi/ctf.json";
import USDC_ABI from "../shared/abi/usdc.json";

export function getUsdcContract(mainnet: boolean, wallet: ethers.Wallet): ethers.Contract {
    const chainId = mainnet ? 137 : 80002;
    const contractConfig = getContractConfig(chainId);
    return new ethers.Contract(contractConfig.collateral, USDC_ABI, wallet);
}

// const contract = getUsdcContract(
//   true,
//   new ethers.Wallet(PRIVATE_KEY, new ethers.JsonRpcProvider(RPC_URL))
// );

export function getCtfContract(mainnetQ: boolean, wallet: ethers.Wallet): ethers.Contract {
    const chainId = mainnetQ ? 137 : 80002;
    const contractConfig = getContractConfig(chainId);
    return new ethers.Contract(contractConfig.conditionalTokens, CTF_ABI, wallet);
}

// const ctfContract = getCtfContract(true, getWallet(true));
// console.log(ctfContract);

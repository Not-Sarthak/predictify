import { getContractConfig } from "@polymarket/clob-client";
import { ethers } from "ethers";
import CTF_ABI from "../shared/abi/ctf.json";
import USDC_ABI from "../shared/abi/usdc.json";

export function getUsdcContract(mainnet: boolean, wallet: ethers.Wallet): ethers.Contract {
    const chainId = mainnet ? 137 : 80002;
    const contractConfig = getContractConfig(chainId);
    return new ethers.Contract(contractConfig.collateral, USDC_ABI, wallet);
}

export function getCtfContract(mainnetQ: boolean, wallet: ethers.Wallet): ethers.Contract {
    const chainId = mainnetQ ? 137 : 80002;
    const contractConfig = getContractConfig(chainId);
    return new ethers.Contract(contractConfig.conditionalTokens, CTF_ABI, wallet);
}

import { getContractConfig } from "@polymarket/clob-client";
import { getCtfContract, getUsdcContract } from "../../helpers/contract-utilities";
import type { BigNumberish } from "ethers";
import { ethers } from "ethers";
import { CHAIN_ID } from "@/shared/constants";
import { env } from "@/config";

// THIS IS A VERY IMPORTANT FUNCTION - TOOK US A MONTH TO REALIZE
export async function setNegativeRiskAllowance(privateKey: string) {
    const provider = new ethers.JsonRpcProvider(env.MAINNET_RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);

    const contractConfig = getContractConfig(CHAIN_ID);
    const usdc = getUsdcContract(true, wallet);
    const ctf = getCtfContract(true, wallet);

    const usdcAllowanceNegRiskAdapter = (await usdc.allowance(
        wallet.address,
        contractConfig.negRiskAdapter
    )) as BigNumberish;

    const usdcAllowanceNegRiskExchange = (await usdc.allowance(
        wallet.address,
        contractConfig.negRiskExchange
    )) as BigNumberish;
    const conditionalTokensAllowanceNegRiskExchange = (await ctf.isApprovedForAll(
        wallet.address,
        contractConfig.negRiskExchange
    )) as BigNumberish;
    const conditionalTokensAllowanceNegRiskAdapter = (await ctf.isApprovedForAll(
        wallet.address,
        contractConfig.negRiskAdapter
    )) as BigNumberish;

    // For Splitting through the NegRiskAdapter
    if (ethers.toBigInt(usdcAllowanceNegRiskAdapter) === 0n) {
        await usdc.approve(contractConfig.negRiskAdapter, ethers.MaxUint256, {
            gasPrice: 100_000_000_000,
            gasLimit: 200_000,
        });
    }
    if (ethers.toBigInt(usdcAllowanceNegRiskExchange) === 0n) {
        await usdc.approve(contractConfig.negRiskExchange, ethers.MaxUint256, {
            gasPrice: 100_000_000_000,
            gasLimit: 200_000,
        });
    }
    if (!conditionalTokensAllowanceNegRiskExchange) {
        await ctf.setApprovalForAll(contractConfig.negRiskExchange, true, {
            gasPrice: 100_000_000_000,
            gasLimit: 200_000,
        });
    }
    if (!conditionalTokensAllowanceNegRiskAdapter) {
        await ctf.setApprovalForAll(contractConfig.negRiskAdapter, true, {
            gasPrice: 100_000_000_000,
            gasLimit: 200_000,
        });
    }
}

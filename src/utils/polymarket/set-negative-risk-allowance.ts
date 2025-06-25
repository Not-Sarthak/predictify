import { getContractConfig } from "@polymarket/clob-client";
import { getWallet } from "../../helpers/get-wallet-address";
import { getCtfContract, getUsdcContract } from "../../helpers/contract-utilities";
import type { BigNumberish } from "ethers";
import { ethers } from "ethers";

export async function setNegativeRiskAllowance(mainnet: boolean) {
    const wallet = getWallet(mainnet);
    const chainId = mainnet ? 137 : 80002;

    const contractConfig = getContractConfig(chainId);
    const usdc = getUsdcContract(mainnet, wallet);
    const ctf = getCtfContract(mainnet, wallet);

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

    let txn;

    // For Splitting through the NegRiskAdapter
    if (ethers.toBigInt(usdcAllowanceNegRiskAdapter) === 0n) {
        txn = await usdc.approve(contractConfig.negRiskAdapter, ethers.MaxUint256, {
            gasPrice: 100_000_000_000,
            gasLimit: 200_000,
        });
        // console.log(`Setting USDC Allowance for NegRiskAdapter: ${txn.hash}`);
    }
    if (ethers.toBigInt(usdcAllowanceNegRiskExchange) === 0n) {
        txn = await usdc.approve(contractConfig.negRiskExchange, ethers.MaxUint256, {
            gasPrice: 100_000_000_000,
            gasLimit: 200_000,
        });
        // console.log(`Setting USDC Allowance for NegRiskExchange: ${txn.hash}`);
    }
    if (ethers.toBigInt(conditionalTokensAllowanceNegRiskExchange) === 0n) {
        txn = await ctf.setApprovalForAll(contractConfig.negRiskExchange, true, {
            gasPrice: 100_000_000_000,
            gasLimit: 200_000,
        });
        // console.log(
        //   `Setting Conditional Tokens Allowance for NegRiskExchange: ${txn.hash}`
        // );
    }
    if (ethers.toBigInt(conditionalTokensAllowanceNegRiskAdapter) === 0n) {
        txn = await ctf.setApprovalForAll(contractConfig.negRiskAdapter, true, {
            gasPrice: 100_000_000_000,
            gasLimit: 200_000,
        });
        // console.log(
        //   `Setting Conditional Tokens Allowance for NegRiskAdapter: ${txn.hash}`
        // );
    }
    // console.log("Allowances Set");
}

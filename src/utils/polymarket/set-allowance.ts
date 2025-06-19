import { getContractConfig } from "@polymarket/clob-client";
import { ethers } from "ethers";
import { getWallet } from "../../helpers/get-wallet-address";
import type { BigNumberish } from "ethers";
import {
  getCtfContract,
  getUsdcContract,
} from "../../helpers/contract-utilities";

export async function setAllowance(mainnet: boolean) {
  const wallet = getWallet(mainnet);
  const chainId = mainnet ? 137 : 80002;
  const contractConfig = getContractConfig(chainId);
  const USDC = getUsdcContract(mainnet, wallet);
  const CTF = getCtfContract(mainnet, wallet);

  const usdcAllowanceCTF = (await USDC.allowance(
    wallet.address,
    CTF.target
  )) as BigNumberish;
  const usdcAllowanceExchange = (await USDC.allowance(
    wallet.address,
    contractConfig.exchange
  )) as BigNumberish;
  const conditionalTokensAllowanceExchange = (await CTF.isApprovedForAll(
    wallet.address,
    contractConfig.exchange
  )) as BigNumberish;

  let txn;

  if (ethers.toBigInt(usdcAllowanceCTF) === 0n) {
    txn = await USDC.approve(
      contractConfig.conditionalTokens,
      ethers.MaxUint256,
      {
        gasPrice: 100_000_000_000,
        gasLimit: 200_000,
      }
    );
    // console.log(`Setting USDC Allowance for CTF: ${txn.hash}`);
  }
  if (ethers.toBigInt(usdcAllowanceExchange) === 0n) {
    txn = await USDC.approve(contractConfig.exchange, ethers.MaxUint256, {
      gasPrice: 100_000_000_000,
      gasLimit: 200_000,
    });
    // console.log(`Setting USDC Allowance for Exchange: ${txn.hash}`);
  }
  if (!conditionalTokensAllowanceExchange) {
    txn = await CTF.setApprovalForAll(contractConfig.exchange, true, {
      gasPrice: 100_000_000_000,
      gasLimit: 200_000,
    });
    // console.log(`Setting Conditional Tokens Allowance for Exchange: ${txn.hash}`);
  }
  // console.log("Allowances Set");
}

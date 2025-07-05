import { ethers } from "ethers";
import { EXCHANGE_ADDRESS, USDC_ADDRESS } from "../../shared/constants";
import { getWallet } from "../../helpers/get-wallet-address";

const WRAPPED_USDC_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
];

export async function setUSDCAllowance(wallet: ethers.Wallet, amount: string) {
    try {
        const provider = new ethers.JsonRpcProvider("https://polygon-rpc.com");
        const connectedWallet = wallet.connect(provider);

        const usdcContract = new ethers.Contract(USDC_ADDRESS, WRAPPED_USDC_ABI, connectedWallet);

        const currentAllowance = await usdcContract.allowance(
            await wallet.getAddress(),
            EXCHANGE_ADDRESS
        );

        // const currentAllowanceFormatted = ethers.formatUnits(currentAllowance, 6);

        const amountInUnits = ethers.parseUnits(amount, 6);

        if (currentAllowance < amountInUnits) {
            const allowanceAmount = ethers.parseUnits(amount, 6); // 1M USDC allowance

            const tx = await usdcContract.approve(EXCHANGE_ADDRESS, allowanceAmount);

            const receipt = await tx.wait();
            console.log("Transaction Receipt for Wallet `", wallet.address, "`: ", receipt);

            return true;
        } else {
            return true;
        }
    } catch (error) {
        console.error("Error Setting USDC Allowance for Wallet: ", wallet.address, error);
    }
}

setUSDCAllowance(getWallet(true), "1000000").then((result) => {
    console.log(result);
});

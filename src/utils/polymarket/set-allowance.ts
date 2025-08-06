import { ethers } from "ethers";
import { EXCHANGE_ADDRESS, USDC_ADDRESS } from "../../shared/constants";
import { env } from "../../config";

const WRAPPED_USDC_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
];

export async function setUSDCAllowance(wallet: ethers.Wallet, amount: string) {
    try {
        const provider = new ethers.JsonRpcProvider(env.MAINNET_RPC_URL);
        const connectedWallet = wallet.connect(provider);

        const usdcContract = new ethers.Contract(USDC_ADDRESS, WRAPPED_USDC_ABI, connectedWallet);

        const currentAllowance = await usdcContract.allowance(
            await wallet.getAddress(),
            EXCHANGE_ADDRESS
        );

        const formattedAmount = parseFloat(amount).toFixed(6);
        const amountInUnits = ethers.parseUnits(formattedAmount, 6);

        if (currentAllowance < amountInUnits) {
            const allowanceAmount = amountInUnits;

            const tx = await usdcContract.approve(EXCHANGE_ADDRESS, allowanceAmount);

            const receipt = await tx.wait();
            console.log(`Set Allowance For Wallet ${wallet.address}: ${formattedAmount} USDC`);

            return receipt.hash;
        }

        return null;
    } catch (error) {
        console.error(`Error Setting USDC Allowance For Wallet ${wallet.address}:`, error);
        throw error;
    }
}

import { ethers } from "ethers";
import { EXCHANGE_ADDRESS, USDC_ADDRESS } from "../../shared/constants";
import { env } from "../../config";

const WRAPPED_USDC_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
];

export async function setUSDCAllowance(wallet: ethers.Wallet) {
    try {
        const provider = new ethers.JsonRpcProvider(env.MAINNET_RPC_URL);
        const connectedWallet = wallet.connect(provider);

        const usdcContract = new ethers.Contract(USDC_ADDRESS, WRAPPED_USDC_ABI, connectedWallet);
        const owner = await wallet.getAddress();

        const currentAllowance: bigint = await usdcContract.allowance(owner, EXCHANGE_ADDRESS);

        // Check if allowance is already above 10 USDC
        const tenUSDC = ethers.parseUnits("10", 6);
        if (currentAllowance >= tenUSDC) {
            console.log(
                `Wallet ${wallet.address}: Allowance already sufficient (${ethers.formatUnits(currentAllowance, 6)} USDC)`
            );
            return null;
        }

        // Set allowance to 100,000,000 USDC
        const newAllowance = ethers.parseUnits("100000000", 6);
        const tx = await usdcContract.approve(EXCHANGE_ADDRESS, newAllowance);
        const receipt = await tx.wait();

        console.log(`Wallet ${wallet.address}: Allowance updated to 100,000,000 USDC`);
        return receipt.hash;
    } catch (error) {
        console.error(`Error setting USDC allowance for wallet ${wallet.address}:`, error);
        throw error;
    }
}

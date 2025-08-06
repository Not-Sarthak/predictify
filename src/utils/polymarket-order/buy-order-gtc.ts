import { type ApiKeyCreds, ClobClient, Side, OrderType } from "@polymarket/clob-client";
import { ethers } from "ethers";
import { getUserWrappedUSDCBalance } from "../../helpers/get-user-balance";
import { setUSDCAllowance } from "../polymarket/set-allowance";
import { createLegacyWallet } from "../../utils";
import { CHAIN_ID, HOST } from "../../shared/constants";
import { setNegativeRiskAllowance } from "../../utils/polymarket/set-negative-risk-allowance";

interface BuyOrderGTCRequest {
    size: number;
    price: number;
    orderType: OrderType;
    tokenId: string;
    side: Side;
    feeRateBps: number;
    apiCreds: ApiKeyCreds;
    privateKey: string;
}

// GTC -> Good Till Canceled. Order Stays Active until you Manually Cancel it or it gets Filled
export async function buyOrderGTC(orderRequest: BuyOrderGTCRequest) {
    const wallet = new ethers.Wallet(orderRequest.privateKey);
    const walletAddress = await wallet.getAddress();
    const clobClient = new ClobClient(
        HOST,
        CHAIN_ID,
        createLegacyWallet(wallet) as any,
        orderRequest.apiCreds
    );

    const balance = await getUserWrappedUSDCBalance(walletAddress);
    const totalCost = orderRequest.price * orderRequest.size;

    if (balance < totalCost) {
        return {
            response: null,
            error: `You have Insufficient Wrapped USDC Balance.\n\nRequired: ${totalCost.toString()} USDC\nAvailable: ${balance.toLocaleString()} USDC`,
        };
    }

    try {
        await setUSDCAllowance(wallet, totalCost.toString());
    } catch (error) {
        console.error("Error setting USDC Allowance: ", error);
        return {
            response: null,
            error: "Error setting USDC Allowance",
        };
    }

    await setNegativeRiskAllowance(orderRequest.privateKey);

    try {
        const order = await clobClient.createOrder({
            tokenID: orderRequest.tokenId,
            price: Number(orderRequest.price.toFixed(4)),
            side: orderRequest.side,
            size: Number(orderRequest.size.toFixed(6)),
            feeRateBps: 0,
        });

        const response = await clobClient.postOrder(order, orderRequest.orderType);

        if (response.error) {
            throw new Error(response.error);
        }

        return { response, error: null };
    } catch (error) {
        console.error("Error Placing GTC Order: ", error);
        return {
            response: null,
            error,
        };
    }
}

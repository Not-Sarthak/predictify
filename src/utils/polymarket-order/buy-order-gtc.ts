import { type ApiKeyCreds, ClobClient, Side, OrderType } from "@polymarket/clob-client";
import { ethers } from "ethers";
import { checkNetworkConnection } from "../../utils/check-network-connection";
import { getUserWrappedUSDCBalance } from "../../helpers/get-user-balance";
import { setUSDCAllowance } from "../polymarket/set-allowance";
import { createLegacyWallet } from "../../utils";

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
    try {
        const wallet = new ethers.Wallet(orderRequest.privateKey);
        const walletAddress = await wallet.getAddress();
        let txHash;

        const networkOk = await checkNetworkConnection();
        if (!networkOk) {
            console.error("Network Connection Failed");
            return { response: null, error: "Internal Server Error" };
        }

        const balance = await getUserWrappedUSDCBalance(walletAddress);
        const totalCost = orderRequest.price * orderRequest.size;

        if (balance < totalCost) {
            return {
                response: null,
                error: `You have Insufficient Wrapped USDC Balance.\n\nRequired: ${totalCost.toString()} USDC\nAvailable: ${balance.toLocaleString()} USDC`,
            };
        }

        try {
            txHash = await setUSDCAllowance(wallet, totalCost.toString());
        } catch (error) {
            console.error("Error setting USDC Allowance: ", error);
            return {
                response: null,
                error: "Error setting USDC Allowance",
            };
        }

        const host = "https://clob.polymarket.com";
        const chainId = 137;

        const clobClient = new ClobClient(
            host,
            chainId,
            createLegacyWallet(wallet) as any,
            orderRequest.apiCreds
        );

        try {
            const order = await clobClient.createOrder({
                tokenID: orderRequest.tokenId,
                price: orderRequest.price,
                side: orderRequest.side,
                size: orderRequest.size,
                feeRateBps: 0,
            });

            const response = await clobClient.postOrder(order, orderRequest.orderType);

            if (response.error) {
                throw new Error(response.error);
            }

            return { response, tx: txHash, error: null };
        } catch (error) {
            console.error("Error Creating GTC Order: ", error);
            return {
                response: null,
                error: error,
            };
        }
    } catch (error) {
        console.error("Error Placing GTC Order:");
        console.error(error);
    }
}

// const creds: ApiKeyCreds = {
//   key: process.env.CLOB_API_KEY || "f3e137a7-3a85-d6fa-292a-3db867dcd441",
//   secret:
//     process.env.CLOB_SECRET || "8qfO6fgz14qvKZPKO-74PRuepSbaexlJLVtscoPnsLY=",
//   passphrase:
//     process.env.CLOB_PASS_PHRASE ||
//     "d1294f22392578c29e9caaeac0ae40bcc2c37a75578bdf78dafd38178bc25a9e",
// };

// buyOrderGTC({
//     // Minimum Size = $1
//     size: 3,
//     // Minimum = 0.001 and Maximum = 0.999
//     price: 0.5,
//     orderType: OrderType.GTC,
//     tokenId: "25009308950201377351599447846248861147611469669632550804193755818060327719237",
//     side: Side.BUY,
//     feeRateBps: 0,
//     apiCreds: creds,
//     privateKey: "0x68afd4e25df9f64382038e4aae0ec7ba4a9833c1079dc1521538656a9d2ef1c3"
// });

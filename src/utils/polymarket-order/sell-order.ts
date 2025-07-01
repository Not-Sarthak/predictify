import { ethers } from "ethers";
import { env } from "../../config/env";
import { ClobClient, OrderType, Side, type ApiKeyCreds } from "@polymarket/clob-client";
import { CHAIN_ID } from "@/shared/constants";
import { createLegacyWallet } from "@/shared/utils";
import { fetchClobPriceHistory } from "../polymarket/get-token-marketprice";
import { getUserWrappedUSDCBalance } from "../../helpers/get-user-balance";

interface SellOrderDetailsInterface {
    tokenId: string;
    size: number;
    price: number;
    orderType: OrderType;
    creds: ApiKeyCreds;
}

export async function sellOrder(sellOrderDetails: SellOrderDetailsInterface) {
    try {
        const wallet = new ethers.Wallet(env.PRIVATE_KEY);

        const host = env.CLOB_API_URL;
        const chainId = CHAIN_ID;

        const clobClient = new ClobClient(
            host,
            chainId,
            createLegacyWallet(wallet) as any,
            sellOrderDetails.creds
        );

        const priceRange = await fetchClobPriceHistory(sellOrderDetails.tokenId);

        if (priceRange && priceRange.length > 0) {
            let currentMarketPrice = null;
            for (const interval of priceRange) {
                if (interval.data && interval.data.history && interval.data.history.length > 0) {
                    const latestPrice = interval.data.history[interval.data.history.length - 1];
                    currentMarketPrice = latestPrice.p;
                    break;
                }
            }

            if (currentMarketPrice !== null) {
                const priceThreshold = 0.5;
                const minAcceptablePrice = currentMarketPrice * (1 - priceThreshold);
                const maxAcceptablePrice = currentMarketPrice * (1 + priceThreshold);

                if (sellOrderDetails.price < minAcceptablePrice) {
                    console.log("Price too Low");
                }

                if (sellOrderDetails.price > maxAcceptablePrice) {
                    console.log("Price too High");
                }
            }
        }

        const userBalance = await getUserWrappedUSDCBalance(wallet.address);

        if (userBalance < sellOrderDetails.price * sellOrderDetails.size) {
            console.log("Insufficient Balance");
        }

        const order = await clobClient.createOrder({
            tokenID: sellOrderDetails.tokenId,
            price: sellOrderDetails.price,
            side: Side.SELL,
            size: sellOrderDetails.size,
            feeRateBps: 0,
        });

        const response = await clobClient.postOrder(order, sellOrderDetails.orderType);
        console.log("Sell Order Response:", response);
        return response;
    } catch (error) {
        console.error("Error Selling Order:", error);
        throw error;
    }
}

// sellOrder({
//   tokenId:
//     "25009308950201377351599447846248861147611469669632550804193755818060327719237",
//   price: 0.03,
//   size: 6,
//   orderType: OrderType.GTC,
//   creds: {
//     key: process.env.CLOB_API_KEY || "f3e137a7-3a85-d6fa-292a-3db867dcd441",
//     secret:
//       process.env.CLOB_SECRET || "8qfO6fgz14qvKZPKO-74PRuepSbaexlJLVtscoPnsLY=",
//     passphrase:
//       process.env.CLOB_PASS_PHRASE ||
//       "d1294f22392578c29e9caaeac0ae40bcc2c37a75578bdf78dafd38178bc25a9e",
//   },
// });

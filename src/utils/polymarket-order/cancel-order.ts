import { ethers } from "ethers";
import { env } from "../../config/env";
import { ClobClient, type ApiKeyCreds } from "@polymarket/clob-client";
import { CHAIN_ID } from "@/shared/constants";
import { createLegacyWallet } from "@/shared/utils";

interface CancelOrderRequest {
    privateKey: string;
    orderIds: string[];
    creds: ApiKeyCreds;
}

export const cancelOrder = async (cancelOrderRequest: CancelOrderRequest) => {
    const wallet = new ethers.Wallet(env.PRIVATE_KEY);

    const host = env.CLOB_API_URL;
    const chainId = CHAIN_ID;

    const clobClient = new ClobClient(
        host,
        chainId,
        createLegacyWallet(wallet) as any,
        cancelOrderRequest.creds // API credentials
    );

    const response = await clobClient.cancelOrders(cancelOrderRequest.orderIds);
    console.log("Response:", response);

    return response;
};

// cancelOrder({
//   privateKey: PRIVATE_KEY,
//   orderIds: ["0x0000000000000000000000000000000000000000000000000000000000000000"],
//   creds: {
//     key: "f3e137a7-3a85-d6fa-292a-3db867dcd441",
//     secret: "8qfO6fgz14qvKZPKO-74PRuepSbaexlJLVtscoPnsLY=",
//     passphrase:
//       "d1294f22392578c29e9caaeac0ae40bcc2c37a75578bdf78dafd38178bc25a9e",
//   },
// });

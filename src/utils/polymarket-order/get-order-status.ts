import { ethers } from "ethers";
import { env } from "../../config/env";
import { ClobClient, type ApiKeyCreds } from "@polymarket/clob-client";

interface OrderStatusDetailsInterface {
    orderId: string;
    creds: ApiKeyCreds;
}

export async function getOrderStatus(orderStatusDetails: OrderStatusDetailsInterface) {
    try {
        const wallet = new ethers.Wallet(env.PRIVATE_KEY);
        const host = "https://clob.polymarket.com";
        const chainId = 137;

        const clobClient = new ClobClient(host, chainId, wallet as any, orderStatusDetails.creds);

        const orderDetails = await clobClient.getOrder(orderStatusDetails.orderId);
        console.log(orderDetails);
        return orderDetails;
    } catch (error) {
        console.error("💥 Error getting order status:");
        console.error(error);
        throw error;
    }
}

// getOrderStatus({
//     orderId: "0xa69f1aeb0180b700272c9185127e13efbc15df256a8ac8c8fae709e2a42a4db4",
//     creds: {
//         key: process.env.CLOB_API_KEY || "f3e137a7-3a85-d6fa-292a-3db867dcd441",
//         secret: process.env.CLOB_SECRET || "8qfO6fgz14qvKZPKO-74PRuepSbaexlJLVtscoPnsLY=",
//         passphrase: process.env.CLOB_PASS_PHRASE || "d1294f22392578c29e9caaeac0ae40bcc2c37a75578bdf78dafd38178bc25a9e",
//     }
// });

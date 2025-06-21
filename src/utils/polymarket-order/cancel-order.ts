import { ethers } from "ethers";
import { CLOB_API_URL, PRIVATE_KEY } from "../../config/env";
import { CHAIN_ID } from "../../constants/polymarket";
import { ClobClient, type ApiKeyCreds } from "@polymarket/clob-client";
import { createLegacyWallet } from "../../constants/legacy-ethers";

interface CancelOrderRequest {
  privateKey: string;
  orderId: string;
  creds: ApiKeyCreds;
}

export const cancelOrder = async (cancelOrderRequest: CancelOrderRequest) => {
  const wallet = new ethers.Wallet(PRIVATE_KEY);

  const host = CLOB_API_URL;
  const chainId = CHAIN_ID;

  const clobClient = new ClobClient(
    host,
    chainId,
    createLegacyWallet(wallet) as any,
    cancelOrderRequest.creds // API credentials
  );

  const response = await clobClient.cancelOrder({
    orderID: cancelOrderRequest.orderId,
  });
  console.log("Response:", response);

  return response;
};

// cancelOrder({
//   privateKey: PRIVATE_KEY,
//   orderId: "0x0000000000000000000000000000000000000000000000000000000000000000",
//   creds: {
//     key: "f3e137a7-3a85-d6fa-292a-3db867dcd441",
//     secret: "8qfO6fgz14qvKZPKO-74PRuepSbaexlJLVtscoPnsLY=",
//     passphrase:
//       "d1294f22392578c29e9caaeac0ae40bcc2c37a75578bdf78dafd38178bc25a9e",
//   },
// });

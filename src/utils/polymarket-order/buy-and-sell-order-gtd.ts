import { ethers } from "ethers";
import {
  type ApiKeyCreds,
  ClobClient,
  OrderType,
  Side,
  type TickSize,
} from "@polymarket/clob-client";
import { CHAIN_ID } from "../../constants/polymarket";
import { CLOB_API_URL } from "../../config/env";
import { createLegacyWallet } from "../../constants/legacy-ethers";
import { getUserWrappedUSDCBalance } from "../../helpers/get-user-balance";
import { setUSDCAllowance } from "../polymarket/set-allowance";

interface OrderGTDRequest {
  privateKey: string;
  creds: ApiKeyCreds;
  tokenId: string;
  price: number;
  size: number;
  expiration: number;
  tickSize?: TickSize;
  side: Side; // Side.BUY or Side.SELL
}

// GTD -> Good Till Date. Order Stays active until the Expiration Time, then Auto-Cancels.
export async function orderGTD(orderGTDRequest: OrderGTDRequest) {
  const wallet = new ethers.Wallet(orderGTDRequest.privateKey);
  const chainId = CHAIN_ID;
  const host = CLOB_API_URL;
  const clobClient = new ClobClient(
    host,
    chainId,
    createLegacyWallet(wallet) as any,
    orderGTDRequest.creds
  );

  const balance = await getUserWrappedUSDCBalance(wallet.address);
  const totalCost = orderGTDRequest.price * orderGTDRequest.size;

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

  // Eg Time: const oneMinute = parseInt(((new Date().getTime() + 60 * 1000 + 10 * 1000) / 1000).toString());

  try {
    if (orderGTDRequest.side === Side.BUY) {
      const order = await clobClient.createOrder({
        tokenID: orderGTDRequest.tokenId,
        price: orderGTDRequest.price,
        side: orderGTDRequest.side, // Side.BUY or Side.SELL
        size: orderGTDRequest.size,
        expiration: orderGTDRequest.expiration,
      });

      const response = await clobClient.postOrder(order, OrderType.GTD);

      return { response, error: null };
    } else if (orderGTDRequest.side === Side.SELL) {
      const response = await clobClient.createAndPostOrder(
        {
          tokenID: orderGTDRequest.tokenId,
          price: orderGTDRequest.price,
          side: orderGTDRequest.side,
          size: orderGTDRequest.size,
          expiration: orderGTDRequest.expiration,
        },
        { tickSize: orderGTDRequest.tickSize },
        OrderType.GTD
      );

      return { response, error: null };
    }
  } catch (error) {
    console.error("Error placing GTD Order: ", error);
    return { response: null, error };
  }
}

// const creds: ApiKeyCreds = {
//     key: process.env.CLOB_API_KEY || "f3e137a7-3a85-d6fa-292a-3db867dcd441",
//     secret: process.env.CLOB_SECRET || "8qfO6fgz14qvKZPKO-74PRuepSbaexlJLVtscoPnsLY=",
//     passphrase: process.env.CLOB_PASS_PHRASE || "d1294f22392578c29e9caaeac0ae40bcc2c37a75578bdf78dafd38178bc25a9e",
// };

// orderGTD({
//     privateKey: PRIVATE_KEY,
//     creds: creds,
//     tokenId: "25009308950201377351599447846248861147611469669632550804193755818060327719237",
//     price: 0.5,
//     size: 100,
//     expiration: 1000,
//     tickSize: "0.01",
//     side: Side.BUY,
// });

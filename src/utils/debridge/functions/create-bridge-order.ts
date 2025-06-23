import { DEBRIDGE_API_URL } from "../../../config/env";
import type { deBridgeOrderInput, deBridgeOrderResponse } from "../types";

export async function createDebridgeBridgeOrder(params: deBridgeOrderInput,): Promise<deBridgeOrderResponse> {
  if (params.srcChainId === params.dstChainId) {
    throw new Error("Source and Destination Chains must be Different");
  }

  const queryParams = new URLSearchParams({
    srcChainId: params.srcChainId,
    srcChainTokenIn: params.srcChainTokenIn,
    srcChainTokenInAmount: params.srcChainTokenInAmount,
    dstChainId: params.dstChainId,
    dstChainTokenOut: params.dstChainTokenOut,
    dstChainTokenOutRecipient: params.dstChainTokenOutRecipient,
    senderAddress: params.account,
    srcChainOrderAuthorityAddress: params.account,
    srcChainRefundAddress: params.account,
    dstChainOrderAuthorityAddress: params.dstChainTokenOutRecipient,
    prependOperatingExpenses: "true",
  });

  const response = await fetch(
    `${DEBRIDGE_API_URL}/dln/order/create-tx?${queryParams}`,
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to create bridge order: ${response.statusText}. ${errorText}`,
    );
  }

  const data = await response.json() as deBridgeOrderResponse;

  if ('error' in data && data.error) {
    throw new Error(`DeBridge API Error: ${data.error}`);
  }

  if ('tx' in data && data.tx?.data) {
    data.tx.data = String(data.tx.data);
  }

  return data;
}
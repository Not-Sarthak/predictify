import { env } from "../../../config/env";
import type { deBridgeOrderInput, deBridgeOrderResponse } from "../types";

export async function createDebridgeBridgeOrder(
    params: deBridgeOrderInput
): Promise<deBridgeOrderResponse | null> {
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

    const response = await fetch(`${env.DEBRIDGE_API_URL}dln/order/create-tx?${queryParams}`);

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to create bridge order: ${response.statusText}. ${errorText}`);
        return null;
    }

    const data = (await response.json()) as deBridgeOrderResponse;

    if ("error" in data && data.error) {
        console.error(`DeBridge API Error: ${data.error}`);
        return null;
    }

    if ("tx" in data && data.tx?.data) {
        data.tx.data = String(data.tx.data);
    }

    return data;
}

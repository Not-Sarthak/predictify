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

    const response = await fetch(`${env.DEBRIDGE_API_URL}/dln/order/create-tx?${queryParams}`);

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to create bridge order: ${response.statusText}. ${errorText}`);

        // Parse error message for better user feedback
        if (errorText.includes("insufficient lamports")) {
            const match = errorText.match(/insufficient lamports (\d+), need (\d+)/);
            if (match) {
                const hasLamports = parseInt(match[1]) / 1e9;
                const needLamports = parseInt(match[2]) / 1e9;
                const shortage = needLamports - hasLamports;
                throw new Error(
                    `Insufficient SOL balance. You have ${hasLamports.toFixed(4)} SOL but need ${needLamports.toFixed(4)} SOL (shortage: ${shortage.toFixed(4)} SOL)`
                );
            }
        }

        throw new Error(`Failed to create bridge order: ${response.statusText}`);
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

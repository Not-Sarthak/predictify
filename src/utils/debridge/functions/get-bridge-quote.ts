import { env } from "../../../config/env";
import type { deBridgeOrderInput, deBridgeOrderResponse } from "../types";

export async function getBridgeQuote(params: deBridgeOrderInput): Promise<deBridgeOrderResponse> {
    if (!params.dstChainTokenOutRecipient) {
        throw new Error("dstChainTokenOutRecipient is required for transaction building");
    }

    const queryParams = new URLSearchParams({
        srcChainId: params.srcChainId,
        srcChainTokenIn: params.srcChainTokenIn,
        srcChainTokenInAmount: params.srcChainTokenInAmount,
        dstChainId: params.dstChainId,
        dstChainTokenOut: params.dstChainTokenOut,
        dstChainTokenOutAmount: params.dstChainTokenOutAmount || "auto",
        prependOperatingExpenses: "false",
        ...(params.slippage && { slippage: params.slippage.toString() }),
    });

    const url = env.DEBRIDGE_API_URL + `dln/order/quote?${queryParams}`;

    const response = await fetch(url);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed To Get Bridge Quote: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as deBridgeOrderResponse;

    if ("error" in data) {
        throw new Error(`API Error: ${data.error}`);
    }

    return data;
}

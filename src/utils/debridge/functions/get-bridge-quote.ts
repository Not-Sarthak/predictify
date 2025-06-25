import { DEBRIDGE_API_URL } from "../../../config/env";
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
        dstChainTokenOutRecipient: params.dstChainTokenOutRecipient,
        prependOperatingExpenses: "true",
        additionalTakerRewardBps: (params.additionalTakerRewardBps || 0).toString(),
        ...(params.slippage && { slippage: params.slippage.toString() }),
        ...(params.srcIntermediaryTokenAddress && {
            srcIntermediaryTokenAddress: params.srcIntermediaryTokenAddress,
        }),
        ...(params.dstIntermediaryTokenAddress && {
            dstIntermediaryTokenAddress: params.dstIntermediaryTokenAddress,
        }),
        ...(params.dstIntermediaryTokenSpenderAddress && {
            dstIntermediaryTokenSpenderAddress: params.dstIntermediaryTokenSpenderAddress,
        }),
        ...(params.intermediaryTokenUSDPrice && {
            intermediaryTokenUSDPrice: params.intermediaryTokenUSDPrice.toString(),
        }),
        ...(params.srcAllowedCancelBeneficiary && {
            srcAllowedCancelBeneficiary: params.srcAllowedCancelBeneficiary,
        }),
        ...(params.referralCode && {
            referralCode: params.referralCode.toString(),
        }),
        ...(params.affiliateFeePercent && {
            affiliateFeePercent: params.affiliateFeePercent.toString(),
        }),
    });

    const url = DEBRIDGE_API_URL + `dln/order/create-tx?${queryParams}`;

    const response = await fetch(url);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get bridge quote: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as deBridgeOrderResponse;

    if ("error" in data) {
        throw new Error(`API Error: ${data.error}`);
    }

    return data;
}

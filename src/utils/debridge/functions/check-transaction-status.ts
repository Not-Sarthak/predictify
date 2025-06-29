import { env } from "../../../config/env";
import type { deBridgeOrderStatusResponse, deBridgeOrderIdsResponse } from "../types";

export async function checkDebridgeTransactionStatus(
    txHash: string
): Promise<deBridgeOrderStatusResponse[]> {
    const orderIdsUrl = `${env.DEBRIDGE_API_URL}/dln/tx/${txHash}/order-ids`;
    const orderIdsResponse = await fetch(orderIdsUrl);
    const responseData = (await orderIdsResponse.json()) as deBridgeOrderIdsResponse;

    if (!orderIdsResponse.ok) {
        if (responseData.errorCode === 2) {
            throw new Error("Invalid transaction hash format");
        } else {
            throw new Error(responseData.errorMessage || "Unknown error");
        }
    }

    const orderIdsData = responseData as deBridgeOrderIdsResponse;
    if (!orderIdsData.orderIds || orderIdsData.orderIds.length === 0) {
        throw new Error("No bridge orders found for this transaction");
    }

    const statuses = await Promise.all(
        orderIdsData.orderIds.map(async (orderId) => {
            const statusUrl = `${env.DEBRIDGE_API_URL}/dln/order/${orderId}/status`;
            const statusResponse = await fetch(statusUrl);

            if (!statusResponse.ok) {
                const text = await statusResponse.text();
                throw new Error(`Failed to get status for order ${orderId}: ${text}`);
            }

            const statusData = (await statusResponse.json()) as deBridgeOrderStatusResponse;
            statusData.orderLink = `https://app.debridge.finance/order?orderId=${orderId}`;
            return statusData;
        })
    );

    return statuses;
}

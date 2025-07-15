import { ClobClient, type OpenOrder } from "@polymarket/clob-client";

export async function getUnmatchedOpenOrders(clobClient: ClobClient, walletAddress: string) {
    try {
        const openOrders = await clobClient.getOpenOrders({});

        const unmatchedOrders = openOrders.filter(
            (order) =>
                order.status === "unmatched" &&
                order.maker_address.toLowerCase() === walletAddress.toLowerCase()
        );

        return unmatchedOrders;
    } catch (error) {
        console.error("Error Fetching Unmatched Open Orders:", error);
    }
}

export async function getOpenUnmatchedOrders(
    clobClient: ClobClient,
    market?: string
): Promise<OpenOrder[]> {
    const orders = await clobClient.getOpenOrders({ market });
    return orders.filter((order) => order.size_matched === "0");
}

import { ClobClient } from "@polymarket/clob-client";

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

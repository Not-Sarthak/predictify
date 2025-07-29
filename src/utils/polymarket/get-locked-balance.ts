import { redisClient } from "@/lib/redis";
import { getUnmatchedOpenOrders } from "@/utils/polymarket/get-non-matched-orders";

export async function getLockedBalance(userId: number): Promise<number> {
    const trackedOrderIds = await redisClient.lRange(`user:order_ids:${userId}`, 0, -1);
    if (!trackedOrderIds || trackedOrderIds.length === 0) return 0;

    const unmatchedOrders = await getUnmatchedOpenOrders(userId, trackedOrderIds);
    if (!unmatchedOrders || unmatchedOrders.length === 0) return 0;

    let totalLocked = 0;

    for (const order of unmatchedOrders) {
        if (order && order.side === "BUY") {
            const remainingSize = parseFloat(order.original_size) - parseFloat(order.size_matched);
            const price = parseFloat(order.price);
            totalLocked += remainingSize * price;
        }
    }

    return totalLocked;
}

import type { ApiKeyCreds } from "@/types/polymarket";

import { getUserDetails } from "@/helpers/get-user-details";
import { CHAIN_ID, HOST } from "@/shared/constants";
import { createLegacyWallet } from "@/utils/create-legacy-wallet";
import { decryptPrivateKey } from "@/utils/crypto";
import { ClobClient } from "@polymarket/clob-client";
import { ethers } from "ethers";
import { redisClient } from "@/lib/redis";

export async function getUnmatchedOpenOrders(userId: number, trackedOrderIds: string[]) {
    const user = await getUserDetails(userId);
    if (!user) return;

    const creds: ApiKeyCreds = JSON.parse(user.api_credentials) as ApiKeyCreds;

    const legacyWallet = createLegacyWallet(new ethers.Wallet(decryptPrivateKey(user.private_key)));
    const clobClient = new ClobClient(HOST, CHAIN_ID, legacyWallet as any, creds);

    const unmatchedOrders = [];
    const redisKey = `user:order_ids:${userId}`;

    try {
        for (const orderId of trackedOrderIds) {
            try {
                const order = await clobClient.getOrder(orderId);
                if (!order) continue;

                if (order.status === "MATCHED" || order.status === "CANCELED") {
                    await redisClient.lRem(redisKey, 0, order.id);
                    continue;
                }

                unmatchedOrders.push(order);
            } catch (error) {
                console.warn(`⚠️ Failed to fetch order ${orderId}:`, error);
            }
        }

        return unmatchedOrders;
    } catch (error) {
        console.error("Error fetching Orders: ", error);
        return null;
    }
}

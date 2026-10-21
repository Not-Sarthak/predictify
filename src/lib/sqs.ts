import AWS from "aws-sdk";
import { env } from "../config/env";

// Initialize SQS client
let sqsClient: AWS.SQS | null = null;

// Initialize SQS only if credentials are provided
if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_REGION) {
    AWS.config.update({
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        region: env.AWS_REGION,
    });

    sqsClient = new AWS.SQS({ apiVersion: "2012-11-05" });
}

export interface OrderMessage {
    userId: string;
    username?: string;
    orderId: string;
    orderType: "fok" | "gtc" | "fok_sell" | "fak_sell";
    // Where the order came from; consumers that only knew manual orders can ignore it
    source?: "manual" | "high_prob" | "copy_trade" | "tp_sl" | "close_position";
    side?: string;
    marketId: string;
    marketQuestion: string;
    amount: number;
    shares?: number;
    executionPrice?: number;
    txHash?: string;
    timestamp: string;
    status: "matched" | "pending" | "cancelled";
    outcome?: string;
}

/**
 * Send order data to SQS queue
 */
export async function sendOrderToSQS(orderData: OrderMessage): Promise<boolean> {
    if (!sqsClient || !env.SQS_QUEUE_URL) {
        console.warn("SQS not configured - skipping order queue");
        return false;
    }

    try {
        const params: AWS.SQS.SendMessageRequest = {
            QueueUrl: env.SQS_QUEUE_URL,
            MessageBody: JSON.stringify(orderData),
            MessageAttributes: {
                orderType: {
                    DataType: "String",
                    StringValue: orderData.orderType,
                },
                userId: {
                    DataType: "String",
                    StringValue: orderData.userId,
                },
                marketId: {
                    DataType: "String",
                    StringValue: orderData.marketId,
                },
                status: {
                    DataType: "String",
                    StringValue: orderData.status,
                },
            },
        };

        const result = await sqsClient.sendMessage(params).promise();
        console.log(`✅ Order sent to SQS: ${result.MessageId}`);
        return true;
    } catch (error) {
        console.error("❌ Failed to send order to SQS:", error);
        return false;
    }
}

/**
 * Check if SQS is configured and available
 */
export function isSQSConfigured(): boolean {
    return sqsClient !== null && !!env.SQS_QUEUE_URL;
}

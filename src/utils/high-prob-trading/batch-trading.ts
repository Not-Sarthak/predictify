import { getUserDetails } from "../../helpers/get-user-details";
import { getUserWrappedUSDCBalance } from "../../helpers/get-user-balance";
import { getLockedBalance } from "../../utils/polymarket/get-locked-balance";
import { getTokenId } from "../../helpers/get-token-id";
import { marketBuyOrder } from "../../utils/polymarket-order/market-buy-order";
import { OrderType, Side } from "@polymarket/clob-client";
import { decryptPrivateKey } from "../../utils/crypto";
import { feeTransaction, transferFeeToTreasury } from "../../utils/fees/fee";
import { trackManualTrade } from "../../utils/trade-tracker";
import { ethers } from "ethers";
import type { HighProbMarket } from "./market-filters";
import type { ApiKeyCreds } from "../../types/polymarket/api-key";
import { updateUserVolume } from "../../helpers/update-user-volume";
import { sendOrderToSQS, type OrderMessage } from "../../lib/sqs";
import {
    updateUserMarketsTraded,
    updateUserTransactionsExecuted,
} from "../../bot/utils/database/update-user-data";

export interface BatchTradeRequest {
    userId: number;
    totalAmount: number;
    markets: HighProbMarket[];
    maxMarkets?: number;
}

export interface TradeResult {
    marketId: string;
    marketTitle: string;
    outcome: "yes" | "no";
    amount: number;
    shares: number;
    price: number;
    success: boolean;
    error?: string;
    transactionHash?: string;
    orderId?: string;
}

export interface BatchTradeResult {
    success: boolean;
    totalAmount: number;
    successfulTrades: TradeResult[];
    failedTrades: TradeResult[];
    totalSuccessfulAmount: number;
    totalFailedAmount: number;
}

/**
 * Executes auto-split batch trades across multiple high-probability markets
 */
export async function executeBatchTrades(request: BatchTradeRequest): Promise<BatchTradeResult> {
    const { userId, totalAmount, markets, maxMarkets = 10 } = request;

    try {
        // Get user details and validate balance
        const userDetails = await getUserDetails(userId);
        if (!userDetails) {
            throw new Error("User details not found");
        }

        const [userBalance, lockedBalance] = await Promise.all([
            getUserWrappedUSDCBalance(userDetails.wallet_address),
            getLockedBalance(userId),
        ]);

        const availableBalance = userBalance - lockedBalance;
        if (availableBalance < totalAmount) {
            throw new Error(
                `Insufficient funds. Available: $${availableBalance.toFixed(2)}, Required: $${totalAmount.toFixed(2)}`
            );
        }

        // Select markets for trading (up to maxMarkets)
        const selectedMarkets = markets.slice(0, maxMarkets);
        if (selectedMarkets.length === 0) {
            throw new Error("No qualifying markets found");
        }

        // Calculate amount per market
        const amountPerMarket = totalAmount / selectedMarkets.length;
        const { finalAmount: finalAmountPerMarket } = feeTransaction(amountPerMarket);

        // Check minimum trade size
        if (finalAmountPerMarket < 5) {
            throw new Error(
                `Trade amount per market too small: $${finalAmountPerMarket.toFixed(2)}. Minimum is $5.`
            );
        }

        const decryptedPrivateKey = decryptPrivateKey(userDetails.private_key);
        const apiCreds: ApiKeyCreds = JSON.parse(userDetails.api_credentials);

        const successfulTrades: TradeResult[] = [];
        const failedTrades: TradeResult[] = [];

        // Execute trades sequentially to avoid rate limits
        for (const market of selectedMarkets) {
            try {
                const tradeResult = await executeSingleTrade({
                    market,
                    amount: finalAmountPerMarket,
                    userId,
                    privateKey: decryptedPrivateKey,
                    apiCreds,
                });

                if (tradeResult.success) {
                    successfulTrades.push(tradeResult);
                } else {
                    failedTrades.push(tradeResult);
                }

                // Small delay between trades to avoid overwhelming the API
                await new Promise((resolve) => setTimeout(resolve, 1000));
            } catch (error) {
                failedTrades.push({
                    marketId: market.id,
                    marketTitle: market.question,
                    outcome: market.bestOutcome,
                    amount: finalAmountPerMarket,
                    shares: 0,
                    price: market.bestPrice,
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        }

        const totalSuccessfulAmount = successfulTrades.reduce(
            (sum, trade) => sum + trade.amount,
            0
        );
        const totalFailedAmount = failedTrades.reduce((sum, trade) => sum + trade.amount, 0);

        // Transfer fees for successful trades
        if (successfulTrades.length > 0) {
            try {
                await transferFeeToTreasury({
                    userWallet: new ethers.Wallet(decryptedPrivateKey),
                    positionAmount: totalSuccessfulAmount,
                    transactionType: "OPEN",
                    userId: userId,
                });
            } catch (error) {
                console.error("Error transferring fees:", error);
            }
        }

        return {
            success: successfulTrades.length > 0,
            totalAmount,
            successfulTrades,
            failedTrades,
            totalSuccessfulAmount,
            totalFailedAmount,
        };
    } catch (error) {
        throw new Error(
            `Batch trade execution failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
    }
}

/**
 * Executes a single trade within a batch
 */
async function executeSingleTrade({
    market,
    amount,
    userId,
    privateKey,
    apiCreds,
}: {
    market: HighProbMarket;
    amount: number;
    userId: number;
    privateKey: string;
    apiCreds: ApiKeyCreds;
}): Promise<TradeResult> {
    try {
        // Get token ID for the best outcome
        const tokenId = await getTokenId(market.bestOutcome.toLowerCase(), market.id);
        if (!tokenId) {
            throw new Error("Token ID not found for market");
        }

        // Execute market order
        const orderResponse = await marketBuyOrder({
            privateKey,
            creds: apiCreds,
            tokenId,
            amount,
            side: Side.BUY,
            orderType: OrderType.FOK,
        });

        if (orderResponse?.error) {
            throw new Error(String(orderResponse.error));
        }

        if (!orderResponse?.response?.success) {
            throw new Error("Order execution failed");
        }

        const user = await getUserDetails(userId);
        const shares = amount / market.bestPrice;

        // Track the trade & Update user data
        await Promise.all([
            trackManualTrade(userId, tokenId, "BUY", shares),
            updateUserVolume(userId, shares),
            updateUserMarketsTraded(userId, user?.markets_traded || 0),
            updateUserTransactionsExecuted(userId, user?.txns_executed || 0),
        ]);

        // Send successful order to SQS
        try {
            const orderData: OrderMessage = {
                userId: userId.toString(),
                username: user?.telegram_username,
                orderId: orderResponse.response.orderID || "",
                orderType: "fok",
                side: market.bestOutcome,
                marketId: market.id,
                marketQuestion: market.question,
                amount,
                shares,
                executionPrice: market.bestPrice,
                txHash: orderResponse.response.transactionsHashes?.[0],
                timestamp: new Date().toISOString(),
                status: "matched",
                outcome: market.bestOutcome,
            };

            await sendOrderToSQS(orderData);
        } catch (error) {
            console.error("Failed to send batch trade order to SQS:", error);
            // Don't fail the trade if SQS fails
        }

        return {
            marketId: market.id,
            marketTitle: market.question,
            outcome: market.bestOutcome,
            amount,
            shares,
            price: market.bestPrice,
            success: true,
            transactionHash: orderResponse.response.transactionsHashes?.[0],
            orderId: orderResponse.response.orderID,
        };
    } catch (error) {
        return {
            marketId: market.id,
            marketTitle: market.question,
            outcome: market.bestOutcome,
            amount,
            shares: 0,
            price: market.bestPrice,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Validates if batch trading is possible
 */
export async function validateBatchTrade(request: BatchTradeRequest): Promise<{
    valid: boolean;
    error?: string;
    availableBalance?: number;
    requiredAmount?: number;
}> {
    try {
        const userDetails = await getUserDetails(request.userId);
        if (!userDetails) {
            return { valid: false, error: "User details not found" };
        }

        const [userBalance, lockedBalance] = await Promise.all([
            getUserWrappedUSDCBalance(userDetails.wallet_address),
            getLockedBalance(request.userId),
        ]);

        const availableBalance = userBalance - lockedBalance;

        if (availableBalance < request.totalAmount) {
            return {
                valid: false,
                error: "Insufficient funds",
                availableBalance,
                requiredAmount: request.totalAmount,
            };
        }

        if (request.markets.length === 0) {
            return { valid: false, error: "No qualifying markets found" };
        }

        const maxMarkets = request.maxMarkets || 10;
        const selectedMarkets = request.markets.slice(0, maxMarkets);
        const amountPerMarket = request.totalAmount / selectedMarkets.length;
        const { finalAmount } = feeTransaction(amountPerMarket);

        if (finalAmount < 5) {
            return {
                valid: false,
                error: `Amount per market too small: $${finalAmount.toFixed(2)}. Minimum is $5.`,
            };
        }

        return { valid: true, availableBalance };
    } catch (error) {
        return {
            valid: false,
            error: error instanceof Error ? error.message : "Validation failed",
        };
    }
}

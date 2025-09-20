import type { UserPositionResponse } from "../../types/polymarket";

import { Context, Markup } from "telegraf";
import { getUserIdFromCtx } from "../utils";
import { getUserAddressFromId } from "../../helpers/get-user-address-from-id";
import { getUserDetails } from "../../helpers/get-user-details";
import { getUserPositionByMarket } from "../../utils/polymarket/get-user-position";
import { decodeMarketId } from "../../utils/encoding";
import { decryptPrivateKey } from "../../utils/crypto";
import { redeemPositions, redeemNegRiskPositions } from "../../utils/polymarket/redeem";
import { setNegativeRiskAllowance } from "../../utils/polymarket/set-negative-risk-allowance";
import axios from "axios";

export async function handleRedeemPosition(ctx: Context, conditionId: string) {
    const decodedConditionId = decodeMarketId(conditionId);

    const userId = getUserIdFromCtx(ctx);
    const userAddress = await getUserAddressFromId(userId);

    if (!userAddress) {
        await ctx.answerCbQuery("❌ User Wallet Not Found");
        return ctx.reply("❌ User Wallet Not Found");
    }

    const position = await getUserPositionByMarket(userAddress, decodedConditionId);

    // Only allow showing redeem UI when the position is redeemable and market is resolved
    // (current price equals 1 for the winning outcome) and the user has a positive size.
    if (!position || position.size <= 0 || !position.redeemable || position.curPrice !== 1) {
        await ctx.answerCbQuery("❌ No redeemable position found");
        return ctx.reply("❌ You don't have any redeemable shares in this market.");
    }

    await ctx.answerCbQuery("Redeem Position?");

    const marketType = position.negativeRisk ? " (NegRisk)" : "";
    const message =
        `💰 **Redeem Position**${marketType}\n\n` +
        `Market: **${position.title}**\n` +
        `Shares: **${position.size.toFixed(2)}**\n` +
        `Outcome: **${position.outcome}**\n\n` +
        `This Will Redeem Your Shares for USDC based on the Market Resolution.\n\n` +
        `Do you want to proceed?`;

    return ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
            [
                Markup.button.callback("✅ Confirm Redeem", `confirm_redeem_${conditionId}`),
                Markup.button.callback("❌ Cancel", "close_message"),
            ],
        ]).reply_markup,
    });
}

export async function handleConfirmRedeem(ctx: Context, conditionId: string) {
    const decodedConditionId = decodeMarketId(conditionId);

    const userId = getUserIdFromCtx(ctx);
    const user = await getUserDetails(userId);

    if (!user) {
        return ctx.reply("❌ Unable to find user details.");
    }

    const { message_id } = await ctx.reply("⏳ Processing redemption...");

    try {
        const userPositions = await axios.get<UserPositionResponse[]>(
            `https://data-api.polymarket.com/positions?user=${user.wallet_address}`
        );

        // Find the position for the specific market that is redeemable and resolved
        const [position] = userPositions.data.filter(
            (pos) => pos.redeemable && pos.curPrice === 1 && pos.conditionId === decodedConditionId
        );

        if (!position) {
            await ctx.deleteMessage(message_id);
            return ctx.reply("❌ No redeemable position found for this market.");
        }

        // Additional validation for position size
        if (position.size <= 0) {
            await ctx.deleteMessage(message_id);
            return ctx.reply("❌ Position size is 0 or negative, cannot redeem.");
        }

        let result;

        // Check if this is a NegRisk market and use appropriate redeem function
        if (position.negativeRisk) {
            // For NegRisk markets, ensure allowances are set first
            try {
                await setNegativeRiskAllowance(decryptPrivateKey(user.private_key));
            } catch (allowanceError) {
                console.error("Failed to set NegRisk allowances:", allowanceError);
                // Continue anyway, the error might be more specific in the redeem call
            }

            const asset = position.asset;
            const oppositeAsset = position.oppositeAsset;

            result = await redeemNegRiskPositions({
                privateKey: decryptPrivateKey(user.private_key),
                conditionId: decodedConditionId,
                asset,
                oppositeAsset,
                outcomeIndex: position.outcomeIndex,
            });
        } else {
            // Use regular redeem for non-NegRisk markets
            result = await redeemPositions({
                privateKey: decryptPrivateKey(user.private_key),
                conditionId: decodedConditionId,
            });
        }

        await ctx.deleteMessage(message_id);

        if (result.success) {
            return ctx.reply(
                `✅ **Position Redeemed Successfully!**\n\n` +
                    `Your USDC has been credited to your wallet.\n\n` +
                    `[View on Polygonscan](https://polygonscan.com/tx/${result.transactionHash})`,
                { parse_mode: "Markdown" }
            );
        } else {
            const errorMsg = result.error || "Unknown error";
            console.error("Redemption failed:", errorMsg);

            // Provide more specific error messages based on the error type
            if (errorMsg.includes("Insufficient")) {
                return ctx.reply(
                    `❌ **Redemption Failed**\n\n` +
                        `${errorMsg}\n\n` +
                        `This might happen if:\n` +
                        `• The market is not fully resolved yet\n` +
                        `• Token balances don't match the API data\n` +
                        `• Network congestion or gas issues\n\n` +
                        `Please try again in a few minutes.`,
                    { parse_mode: "Markdown" }
                );
            } else {
                return ctx.reply(`❌ Redemption failed: ${errorMsg}`);
            }
        }
    } catch (error) {
        console.error("Error redeeming position:", error);
        await ctx.deleteMessage(message_id);
        return ctx.reply(
            "❌ An error occurred while redeeming your position. Please try again later."
        );
    }
}

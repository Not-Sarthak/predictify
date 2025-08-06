import { Context, Markup } from "telegraf";
import { getUserIdFromCtx } from "../utils";
import { getUserAddressFromId } from "../../helpers/get-user-address-from-id";
import { getUserDetails } from "../../helpers/get-user-details";
import { getUserPositionByMarket } from "../../utils/polymarket/get-user-position";
import { decodeMarketId } from "../../utils/encoding";
import { decryptPrivateKey } from "../../utils/crypto";
import { redeemPositions } from "../../utils/polymarket/redeem";

export async function handleRedeemPosition(ctx: Context, conditionId: string) {
    const decodedConditionId = decodeMarketId(conditionId);

    const userId = getUserIdFromCtx(ctx);
    const userAddress = await getUserAddressFromId(userId);

    if (!userAddress) {
        await ctx.answerCbQuery("❌ User Wallet Not Found");
        return ctx.reply("❌ User Wallet Not Found");
    }

    const position = await getUserPositionByMarket(userAddress, decodedConditionId);

    if (!position || position.size <= 0) {
        await ctx.answerCbQuery("❌ No position found");
        return ctx.reply("❌ You Don't Have Any Shares in this Market to Redeem.");
    }

    await ctx.answerCbQuery("Redeem Position?");

    const message =
        `💰 **Redeem Position**\n\n` +
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
        const position = await getUserPositionByMarket(user.wallet_address, decodedConditionId);

        if (!position) {
            await ctx.deleteMessage(message_id);
            return ctx.reply("❌ Position not found.");
        }

        const result = await redeemPositions({
            privateKey: decryptPrivateKey(user.private_key),
            conditionId: decodedConditionId,
            amount: position.size,
            creds: JSON.parse(user.api_credentials),
        });

        await ctx.deleteMessage(message_id);

        if (result.success) {
            return ctx.reply(
                `✅ **Position Redeemed Successfully!**\n\n` +
                    `Transaction: \`${result.transactionHash}\`\n\n` +
                    `Your USDC has been credited to your wallet.`,
                { parse_mode: "Markdown" }
            );
        } else {
            return ctx.reply(`❌ Redemption failed: ${result.error || "Unknown error"}`);
        }
    } catch (error) {
        console.error("Error redeeming position:", error);
        await ctx.deleteMessage(message_id);
        return ctx.reply(
            "❌ An error occurred while redeeming your position. Please try again later."
        );
    }
}

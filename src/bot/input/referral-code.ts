import type { Context } from "telegraf";
import { db } from "@/lib/supabase";
import { getUserIdFromCtx } from "@/bot/utils";
import { handleStartCommand } from "@/bot/commands/start";
import { awaitingReferralCodeInputSet } from "@/bot";

export async function handleReferralCodeTextMessage(ctx: Context, textMessage: string) {
    const userId = getUserIdFromCtx(ctx);
    const referralCode = textMessage.trim();

    // Check if referral code exists
    const { data: referralData, error: referralError } = await db("Users")
        .select("id")
        .eq("referred_code", referralCode)
        .single();

    if (referralError || !referralData) {
        return ctx.reply("❌ Invalid referral code. Please try again with a valid code.");
    }

    // Update referrer's count
    await db("Users")
        .update({
            number_of_referrals: db.raw("number_of_referrals + 1"),
        })
        .eq("id", referralData.id);

    // Store referral info for the new user
    const { error: updateError } = await db("Users")
        .update({
            referral_code: referralCode,
            referred_by: referralData.id,
        })
        .eq("id", userId);

    if (updateError) {
        return ctx.reply("❌ Error processing referral code. Please try again later.");
    }

    // Remove from awaiting set
    awaitingReferralCodeInputSet.delete(userId.toString());

    // Continue with normal start flow
    return handleStartCommand(ctx);
}

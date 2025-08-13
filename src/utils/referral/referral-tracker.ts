import { db } from "../../lib/supabase";

export interface ReferralStats {
    totalReferred: number;
    totalEarnings: number;
    referralLink: string;
    referredUsers: {
        username: string;
        joinDate: string;
        totalVolume: number;
    }[];
}

export async function trackReferralRelationship(
    newUserId: number,
    referrerUsername: string
): Promise<{ success: boolean; referrer?: any; error?: string }> {
    try {
        const { data: referrer, error: referrerError } = await db("Users")
            .select("*")
            .eq("telegram_username", referrerUsername)
            .single();

        if (referrerError || !referrer) {
            return { success: false, error: "Referrer not found" };
        }

        const { error: updateError } = await db("Users")
            .update({ referred_code: referrerUsername })
            .eq("id", newUserId);

        if (updateError) {
            return { success: false, error: "Failed to update referral relationship" };
        }

        // Update referrer's count
        await db("Users")
            .update({
                number_of_referrals: (referrer.number_of_referrals || 0) + 1,
            })
            .eq("id", referrer.id);

        return { success: true, referrer };
    } catch (error) {
        console.error("Error tracking referral relationship:", error);
        return { success: false, error: "Internal error" };
    }
}

export async function calculateReferralEarnings(
    userId: number,
    tradeVolume: number,
    treasuryFee: number
): Promise<void> {
    try {
        const { data: user, error: userError } = await db("Users")
            .select("referred_code")
            .eq("id", userId)
            .single();

        if (userError || !user || !user.referred_code || user.referred_code === "OPEN") {
            return;
        }

        const { data: referrer, error: referrerError } = await db("Users")
            .select("id, fees_total")
            .eq("telegram_username", user.referred_code)
            .single();

        if (referrerError || !referrer) {
            return;
        }

        const referralFee = treasuryFee * 0.25;

        await db("Users")
            .update({
                fees_total: (referrer.fees_total || 0) + referralFee,
            })
            .eq("id", referrer.id);

        console.log(
            `✅ Added referral earning: $${referralFee.toFixed(4)} to referrer ${referrer.id} from user ${userId}`
        );
    } catch (error) {
        console.error("Error calculating referral earnings:", error);
    }
}

export async function getReferralStats(
    userId: number,
    botUsername?: string
): Promise<ReferralStats> {
    try {
        const { data: user, error: userError } = await db("Users")
            .select("telegram_username, number_of_referrals, fees_total")
            .eq("id", userId)
            .single();

        if (userError || !user) {
            throw new Error("User not found");
        }

        const { data: referredUsers, error: referredError } = await db("Users")
            .select("telegram_username, created_at, total_volume")
            .eq("referred_code", user.telegram_username);

        if (referredError) {
            console.error("Error fetching referred users:", referredError);
        }

        const referredUsersList =
            referredUsers?.map((referredUser) => ({
                username: referredUser.telegram_username || "Anonymous",
                joinDate: new Date(referredUser.created_at).toLocaleDateString(),
                totalVolume: referredUser.total_volume || 0,
            })) || [];

        const referralLink = botUsername
            ? `https://t.me/${botUsername}?start=${user.telegram_username}`
            : `t.me/${user.telegram_username}`;

        return {
            totalReferred: user.number_of_referrals || 0,
            totalEarnings: user.fees_total || 0,
            referralLink,
            referredUsers: referredUsersList,
        };
    } catch (error) {
        console.error("Error getting referral stats:", error);
        return {
            totalReferred: 0,
            totalEarnings: 0,
            referralLink: "N/A",
            referredUsers: [],
        };
    }
}

export async function getReferrerFromUsername(
    username: string
): Promise<{ id: number; username: string } | null> {
    try {
        const { data: referrer, error } = await db("Users")
            .select("id, telegram_username")
            .eq("telegram_username", username)
            .single();

        if (error || !referrer) {
            return null;
        }

        return {
            id: referrer.id,
            username: referrer.telegram_username,
        };
    } catch (error) {
        console.error("Error getting referrer from username:", error);
        return null;
    }
}

import { db } from "../lib/supabase";

export async function updateUserVolume(userId: number, volumeToAdd: number): Promise<void> {
    try {
        const { data: currentUser, error: fetchError } = await db("Users")
            .select("total_volume")
            .eq("id", userId)
            .single();

        if (fetchError) {
            console.error("Error fetching user volume:", fetchError);
            return;
        }

        const currentVolume = currentUser?.total_volume || 0;
        const newVolume = currentVolume + volumeToAdd;

        const { error: updateError } = await db("Users")
            .update({ total_volume: newVolume })
            .eq("id", userId);

        if (updateError) {
            console.error("Error updating user volume:", updateError);
            return;
        }

        console.log(
            `Updated user ${userId} volume: ${currentVolume} -> ${newVolume} (+${volumeToAdd})`
        );
    } catch (error) {
        console.error("Error in updateUserVolume:", error);
    }
}

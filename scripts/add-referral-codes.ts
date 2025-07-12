import { db } from "../src/lib/supabase";
import { generateRandomString } from "../src/utils/encoding";

async function addReferralCodesToExistingUsers() {
    try {
        // Get all existing users who don't have a referral code
        const { data: users, error } = await db("Users")
            .select("id, referral_code")
            .is("referral_code", null)
            .neq("id", -1); // Exclude admin placeholder users

        if (error) {
            console.error("Error fetching users:", error);
            return;
        }

        if (!users || users.length === 0) {
            console.log("No users found without referral codes");
            return;
        }

        console.log(`Found ${users.length} users without referral codes`);

        // Update each user with a unique 6-letter referral code
        for (const user of users) {
            let code = generateRandomString(6);
            let isUnique = false;

            // Ensure the code is unique
            while (!isUnique) {
                const { data: existing } = await db("Users")
                    .select("id")
                    .eq("referral_code", code)
                    .single();

                if (!existing) {
                    isUnique = true;
                } else {
                    code = generateRandomString(6);
                }
            }

            const { error: updateError } = await db("Users")
                .update({ referral_code: code })
                .eq("id", user.id);

            if (updateError) {
                console.error(`Error updating user ${user.id}:`, updateError);
            } else {
                console.log(`✅ User ${user.id} updated with referral code: ${code}`);
            }
        }

        console.log("\nCompleted adding referral codes!");

        // Show all users with their referral codes
        const { data: allUsers } = await db("Users")
            .select("id, telegram_username, referral_code")
            .neq("id", -1)
            .order("id");

        console.log("\nAll users with referral codes:");
        console.table(allUsers);
    } catch (error) {
        console.error("Script error:", error);
    }

    process.exit(0);
}

// Run the script
addReferralCodesToExistingUsers();

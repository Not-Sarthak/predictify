import type { Context } from "telegraf";
import { redisClient } from "../../lib/redis";
import { db } from "../../lib/supabase";
import { bot } from "../index";
import { ADMIN_USERS_ID } from "../../shared/constants/misc";

export async function handleConfirmNotification(ctx: Context, userId: number) {
    if (!ADMIN_USERS_ID.includes(userId)) return;

    // GETDEL claims the message, so a double tap on Confirm can't broadcast it twice
    const message = await redisClient.getDel(`notification:message:${userId}`);
    if (!message) {
        return ctx.editMessageText("❌ Message expired. Please try again.");
    }

    try {
        const { data: users, error } = await db("Users").select("id");

        if (error || !users) {
            return ctx.editMessageText("❌ Failed To Fetch Users");
        }

        await ctx.editMessageText(`📤 Sending To ${users.length} Users.`);

        let successCount = 0;
        let failCount = 0;
        const batchSize = 30;
        const delay = 1000;

        for (let i = 0; i < users.length; i += batchSize) {
            const batch = users.slice(i, i + batchSize);

            await Promise.all(
                batch.map(async (user) => {
                    try {
                        await bot.telegram.sendMessage(user.id, message, {
                            parse_mode: "Markdown",
                        });
                        successCount++;
                    } catch (error) {
                        failCount++;
                    }
                })
            );

            if (i + batchSize < users.length) {
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }

        await ctx.editMessageText(
            `✅ Notification Complete!\n\n` +
                `📈 Delivered: ${successCount}\n` +
                `❌ Failed: ${failCount}`
        );
    } catch (error) {
        console.error("Error Sending Notification:", error);
        await ctx.editMessageText("❌ Failed To Send Notification");
    }
}

export async function handleCancelNotification(ctx: Context, userId: number) {
    await redisClient.del(`notification:message:${userId}`);
    await ctx.editMessageText("❌ Notification cancelled");
}

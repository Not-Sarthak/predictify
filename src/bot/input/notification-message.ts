import type { Context } from "telegraf";
import { db } from "../../lib/supabase";
import { clearUserInputState } from "./state";
import { bot } from "../index";

export async function handleNotificationMessage(ctx: Context) {
    const message = ctx.text;
    if (!message) return;

    const userId = ctx.from?.id;
    if (!userId) return;

    await clearUserInputState(userId.toString());

    try {
        const { data: users, error } = await db("Users").select("id");

        if (error || !users) {
            return ctx.reply("❌ Failed To Fetch Users");
        }

        let successCount = 0;
        let failCount = 0;

        await ctx.reply(`📤 Sending Notification To ${users.length} Users...`);

        for (const user of users) {
            try {
                await bot.telegram.sendMessage(user.id, message, { parse_mode: "Markdown" });
                successCount++;
            } catch (error) {
                failCount++;
            }
        }

        await ctx.reply(
            `✅ Notification Sent!\n\n` +
                `📈 Delivered: ${successCount}\n` +
                `❌ Failed: ${failCount}`
        );
    } catch (error) {
        console.error("Error Sending Notification:", error);
        await ctx.reply("❌ Failed To Send Notification");
    }
}

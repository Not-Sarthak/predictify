import type { Context } from "telegraf";
import { getUserIdFromCtx } from "../utils";
import { ADMIN_USERS_ID } from "../../shared/constants/misc";
import { setUserInputState } from "../input/state";

export async function handleNotifyAllCommand(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);
    if (!ADMIN_USERS_ID.includes(userId)) return;

    await setUserInputState(userId.toString(), "notification_message");

    await ctx.reply("📢 Type Your Message To Send To All Users:");
}

import type { Context, Middleware } from "telegraf";

export const requireId: Middleware<Context> = async (ctx, next) => {
    if (!ctx.from?.id) {
        return await ctx.reply("❌ Missing user ID.");
    }
    return next();
};

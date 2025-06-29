import type { Context, Middleware } from "telegraf";

export const rejectBotSenders: Middleware<Context> = async (ctx, next) => {
    if (ctx.from?.is_bot) return;
    return next();
};

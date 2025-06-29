import type { Context } from "telegraf";

export function getUserIdFromCtx(ctx: Context): number {
    return ctx.from!.id;
}

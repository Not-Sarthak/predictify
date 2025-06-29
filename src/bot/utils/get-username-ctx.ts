import type { Context } from "telegraf";

export function getUsernameFromCtx(ctx: Context): string {
    return ctx.from?.username || ctx.from!.first_name;
}

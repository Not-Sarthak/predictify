import type { Context } from "telegraf";

import { getFundMessage } from "../utils/get-fund-message";

export async function handleSettingsCommand(ctx: Context) {
    return await getFundMessage(ctx);
}

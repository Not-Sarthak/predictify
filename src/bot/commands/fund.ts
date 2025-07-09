import { BRIDGE_BUTTON, CLOSE_BUTTON } from "@/bot/ui/buttons";
import { getUserByIdFromDb, getUserIdFromCtx } from "@/bot/utils";
import { Markup, type Context } from "telegraf";

export async function handleFundCommand(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);
    const { data, error } = await getUserByIdFromDb(userId);

    if (error) {
        return ctx.reply("❌ Error fetching your wallet details");
    }

    if (!data) {
        return ctx.reply("❌ User does not exist");
    }

    const { wallet_address, solana_address } = data;

    const message = `
🔐 Your Wallets

• Polygon Address: <code>${wallet_address}</code>
• Solana Address: <code>${solana_address}</code>
`;

    return ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: Markup.inlineKeyboard([[BRIDGE_BUTTON], [CLOSE_BUTTON]]).reply_markup,
    });
}

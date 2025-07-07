import { SETTINGS_MENU_BUTTONS, WALLET_SETTINGS_MENU } from "@/bot/ui/buttons";
import { generateWalletDetailsMessage } from "@/bot/ui/messages";
import { getUserIdFromCtx } from "@/bot/utils";
import {
    getSOLBalance,
    getUserTotalBalance,
    getUserWrappedUSDCBalance,
} from "@/helpers/get-user-balance";
import { db } from "@/lib/supabase";
import { Markup, type Context } from "telegraf";

export async function handleSettingsMenu(ctx: Context) {
    return ctx.editMessageReplyMarkup(Markup.inlineKeyboard(SETTINGS_MENU_BUTTONS).reply_markup);
}

export async function handleWalletSettingsMenu(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);

    const { data: user, error } = await db("Users")
        .select("wallet_address, solana_address")
        .eq("id", userId)
        .single();
    if (error || !user) {
        console.error("Failed to fetch user wallet:", error);
        return ctx.reply("❌ Unable to retrieve wallet info.");
    }

    const evmWalletAddress = user.wallet_address;
    const solanaWalletAddress = user.solana_address;

    const [usdcBalance, solBalance, totalBalance] = await Promise.all([
        getUserWrappedUSDCBalance(evmWalletAddress),
        solanaWalletAddress ? getSOLBalance(solanaWalletAddress) : Promise.resolve(0),
        getUserTotalBalance(evmWalletAddress, solanaWalletAddress),
    ]);

    const message = generateWalletDetailsMessage(
        evmWalletAddress,
        solanaWalletAddress,
        usdcBalance,
        solBalance,
        totalBalance
    );

    const walletSettingsMenu = Markup.inlineKeyboard(WALLET_SETTINGS_MENU);

    return ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: walletSettingsMenu.reply_markup,
    });
}

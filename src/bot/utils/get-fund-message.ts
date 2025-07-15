import { WALLET_SETTINGS_MENU } from "@/bot/ui/buttons";
import { generateWalletDetailsMessage } from "@/bot/ui/messages";
import { getUserIdFromCtx } from "@/bot/utils/get-user-id-ctx";
import { getSOLBalance, getUserWrappedUSDCBalance } from "@/helpers/get-user-balance";
import { db } from "@/lib/supabase";
import { Markup, type Context } from "telegraf";

export async function getFundMessage(ctx: Context) {
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

    const [usdcBalance, solBalance] = await Promise.all([
        getUserWrappedUSDCBalance(evmWalletAddress),
        solanaWalletAddress ? getSOLBalance(solanaWalletAddress) : Promise.resolve(0),
    ]);

    const message = generateWalletDetailsMessage(
        evmWalletAddress,
        solanaWalletAddress,
        usdcBalance,
        solBalance
    );

    const walletSettingsMenu = Markup.inlineKeyboard(WALLET_SETTINGS_MENU);

    return ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: walletSettingsMenu.reply_markup,
    });
}

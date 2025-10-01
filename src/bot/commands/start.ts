import { Markup, type Context } from "telegraf";

import { getUserIdFromCtx } from "../utils";
import { getSOLBalance, getUserWrappedUSDCBalance } from "../../helpers/get-user-balance";
import { generateWelcomeMessage } from "../ui/messages";
import { generateTranslatedMainMenuButtons } from "../ui/buttons/translated";
import { getLockedBalance } from "../../utils/polymarket/get-locked-balance";
import { getUserLanguage } from "../../helpers/user-language";
import { getUserWalletAddresses } from "../utils/database/get-user-addresses";
import { getOrSetCache } from "../../utils";
import { showTermsAcceptance } from "../callbacks/terms";

export async function handleStartCommand(ctx: Context) {
    const iMsg1 = await ctx.reply("⚡ Fetching your profile data...");

    const userId = getUserIdFromCtx(ctx);
    const referrerUsername =
        ctx.message && "text" in ctx.message ? ctx.message.text.split(" ")[1] : undefined;

    const [existingUser, language] = await Promise.all([
        getOrSetCache(`user:${userId}:addresses`, () => getUserWalletAddresses(userId), 43200), // Cache Addresses for 12 Hours
        getUserLanguage(userId),
    ]);

    const translatedButtons = generateTranslatedMainMenuButtons(language);
    const keyboard = Markup.inlineKeyboard(translatedButtons);

    if (existingUser && existingUser.wallet_address) {
        const [balance, solBalance, lockedBalance] = await Promise.all([
            getOrSetCache(
                `user:${userId}:usdc_balance`,
                () => getUserWrappedUSDCBalance(existingUser.wallet_address),
                60
            ),
            getOrSetCache(
                `user:${userId}:sol_balance`,
                () => getSOLBalance(existingUser.solana_address),
                43200 // Higher TTL than USDC Balance as it's not used as often
            ),
            getOrSetCache(`user:${userId}:locked_balance`, () => getLockedBalance(userId), 60),
            ctx.deleteMessage(iMsg1.message_id),
        ]);

        const message = generateWelcomeMessage(
            existingUser.wallet_address,
            existingUser.solana_address,
            balance.toString(),
            solBalance,
            lockedBalance,
            language
        );

        return ctx.reply(message, {
            parse_mode: "HTML",
            reply_markup: keyboard.reply_markup,
        });
    } else {
        // New user - show terms of service first
        ctx.deleteMessage(iMsg1.message_id);
        return showTermsAcceptance(ctx, referrerUsername);
    }
}

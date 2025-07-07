import { Markup, type Context } from "telegraf";

import { getUserIdFromCtx, insertUserInDb } from "@/bot/utils";
import { getUsernameFromCtx } from "@/bot/utils";
import { getUserByIdFromDb } from "@/bot/utils/database/get-user-db";
import { getSOLBalance, getUserWrappedUSDCBalance } from "@/helpers/get-user-balance";
import { generateWelcomeMessage } from "@/bot/ui/messages";
import { MAIN_MENU_BUTTONS } from "@/bot/ui/buttons";
import { generateAPIKeyAndWallet } from "@/utils/polymarket/generate-user";
import { CHAIN_ID, HOST } from "@/shared/constants";

export async function handleStartCommand(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);
    const userName = getUsernameFromCtx(ctx);

    const { data: existingUser, error: dbError } = await getUserByIdFromDb(userId);
    if (dbError) {
        return ctx.reply("❌ Something Went Wrong. Please Try Again Later.");
    }

    if (existingUser) {
        const balance = await getUserWrappedUSDCBalance(existingUser.wallet_address);
        const solBalance = existingUser.solana_address
            ? await getSOLBalance(existingUser.solana_address)
            : 0;
        const message = generateWelcomeMessage(
            existingUser.wallet_address,
            existingUser.solana_address || "N/A",
            balance.toString(),
            solBalance,
            JSON.parse(existingUser.api_credentials)
        );
        const keyboard = Markup.inlineKeyboard(MAIN_MENU_BUTTONS);

        return ctx.reply(message, {
            parse_mode: "HTML",
            reply_markup: keyboard.reply_markup,
        });
    }

    const walletData = await generateAPIKeyAndWallet({
        host: HOST,
        chainId: CHAIN_ID,
    });
    const address = walletData.address;
    const balance = await getUserWrappedUSDCBalance(address);
    const newUserSolBalance = await getSOLBalance(walletData.solanaAddress);

    const { success, error: insertError } = await insertUserInDb(
        userId,
        userName,
        address,
        walletData.privateKey,
        JSON.stringify(walletData.apiCreds),
        walletData.solanaAddress,
        walletData.solanaPrivateKey
    );
    if (!success) {
        console.error(insertError);
        return ctx.reply("❌ There Was an Error Creating Your Account.");
    }

    const keyboard = Markup.inlineKeyboard(MAIN_MENU_BUTTONS);
    const message = generateWelcomeMessage(
        address,
        walletData.solanaAddress,
        balance.toString(),
        newUserSolBalance,
        walletData.apiCreds
    );

    return ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: keyboard.reply_markup,
    });
}

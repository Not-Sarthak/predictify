import { CLOSE_BUTTON, WALLET_SETTINGS_MENU } from "../ui/buttons";
import { getUserIdFromCtx } from "../utils";
import { getUserUSDCBalance } from "../../helpers/get-user-balance";
import { getUserDetails } from "../../helpers/get-user-details";
import { db } from "../../lib/supabase";
import { CHAIN_ID, HOST } from "../../shared/constants";
import { encryptApiCredentials, decryptPrivateKey, encryptPrivateKey } from "../../utils/crypto";
import { generateAPIKeyAndWallet } from "../../utils/polymarket/generate-user";
import { executeSwap, getQuote } from "../../utils/uniswap";
import { ethers } from "ethers";
import { Markup, type Context } from "telegraf";
import { generateTranslatedWalletSettingsMenu } from "../ui/buttons/translated";
import { getUserLanguage } from "../../helpers/user-language";
import { t } from "../../i18n";

export async function handleSettingsMenu(ctx: Context) {
    return ctx.editMessageReplyMarkup(Markup.inlineKeyboard(WALLET_SETTINGS_MENU).reply_markup);
}

export async function handleWalletSettingsMenu(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);
    const translatedButtons = await generateTranslatedWalletSettingsMenu(userId);
    return ctx.editMessageReplyMarkup(Markup.inlineKeyboard(translatedButtons).reply_markup);
}

export async function handleResetWallet(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);
    const language = await getUserLanguage(userId);

    const msg = t("confirmResetMsg", language);

    return ctx.reply(msg, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback(t("confirmResetWallet", language), "confirm_reset_wallet")],
            [CLOSE_BUTTON],
        ]).reply_markup,
    });
}

export async function handleConfirmResetWallet(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);
    const language = await getUserLanguage(userId);

    const { address, privateKey, solanaAddress, solanaPrivateKey, apiCreds } =
        await generateAPIKeyAndWallet({ host: HOST, chainId: CHAIN_ID });

    try {
        const { error } = await db("Users")
            .update({
                wallet_address: address,
                private_key: encryptPrivateKey(privateKey),
                solana_address: solanaAddress,
                solana_private_key: encryptPrivateKey(solanaPrivateKey),
                api_credentials: encryptApiCredentials(apiCreds),
            })
            .eq("id", userId);

        if (error) {
            throw new Error(error.message, { cause: error.cause });
        }
    } catch (error) {
        console.error("Failed to update user wallet details in db: ", error);
        return ctx.reply(t("internalServerError", language));
    }

    return ctx.reply(t("walletReset", language));
}

export async function handleSwapFundsQuoteCallback(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);

    const user = await getUserDetails(userId);
    if (!user) {
        return ctx.reply("❌ User does not exist");
    }

    const userUSDCBalance = await getUserUSDCBalance(user.wallet_address);

    if (userUSDCBalance <= 0) {
        return ctx.reply("⚠️ Your USDC balance is 0. Nothing to quote.");
    }

    try {
        const quote = await getQuote(userUSDCBalance);
        const formattedIn = parseFloat(userUSDCBalance.toFixed(2));

        const message = `
✅ *Quote Summary*

💱 *Swap:*  \`$USDC → $USDCE\`  
🔢 *Amount In:*  \`$${formattedIn}\`  
💰 *Amount Out:*  \`${quote.amountOutFormatted} $USDCE\`  
📊 *Execution Price:*  \`${quote.executionPrice}\`  
📉 *Price Impact:*  \`${quote.priceImpact}%\`  
🛣️ *Path:*  \`${quote.path}\`
        `.trim();

        return ctx.reply(message, {
            parse_mode: "Markdown",
            reply_markup: Markup.inlineKeyboard([
                Markup.button.callback("✅ Execute Swap", "execute_swap"),
            ]).reply_markup,
        });
    } catch (err) {
        console.error("Error while getting swap quotes:", err);
        return ctx.reply("❌ Failed to get swap quote. Please try again later.");
    }
}

export async function handleSwapFundsCallback(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);

    const user = await getUserDetails(userId);
    if (!user) {
        return ctx.reply("❌ User does not exist");
    }

    const userUSDCBalance = await getUserUSDCBalance(user.wallet_address);
    if (userUSDCBalance <= 0) {
        return ctx.reply("⚠️ Your USDC balance is 0. Nothing to quote.");
    }

    const signer = new ethers.Wallet(decryptPrivateKey(user.private_key));

    const message = await ctx.reply("⌛ Swapping your Funds...");

    try {
        const { amountIn, amountOut, executionPrice, transactionHash } = await executeSwap(
            userUSDCBalance,
            0.5,
            signer
        );

        const messageToSend = `
✅ Funds Swapped Successfully!

🔢 *Amount In:*  \`$${amountIn}\`  
💰 *Amount Out:*  \`${amountOut} $USDCE\` 
📊 *Execution Price:*  \`${executionPrice}\` 

📌 Tx Hash: ${transactionHash}

🔗 [View on Polygonscan] (https://polygonscan.com/tx/${transactionHash})
`;

        await ctx.telegram.editMessageText(
            ctx.chat!.id,
            message.message_id,
            undefined,
            messageToSend,
            {
                parse_mode: "Markdown",
            }
        );
    } catch (err) {
        console.error("Error while getting swap quotes:", err);
        return ctx.reply("❌ Failed to get swap quote. Please try again later.");
    }
}

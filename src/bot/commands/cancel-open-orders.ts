import type { ApiKeyCreds } from "@/types/polymarket";
import { Markup, type Context } from "telegraf";

import { env } from "@/config";
import { getUserIdFromCtx } from "@/bot/utils";
import { getUserDetails } from "@/helpers/get-user-details";
import { CHAIN_ID } from "@/shared/constants";
import { createLegacyWallet } from "@/utils";
import { ClobClient } from "@polymarket/clob-client";
import { getUnmatchedOpenOrders } from "@/utils/polymarket/get-non-matched-orders";
import { encodeMarketId } from "@/utils/encoding";
import { ethers } from "ethers";
import { decryptPrivateKey } from "@/utils/crypto";

const host = env.CLOB_API_URL;

export async function handleCancelOpenOrdersCommand(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);
    const user = await getUserDetails(userId);

    if (!user) {
        return ctx.reply("❌ User does not exist");
    }

    const api_creds: ApiKeyCreds = JSON.parse(user.api_credentials);

    const creds: ApiKeyCreds = {
        key: api_creds.key,
        secret: api_creds.secret,
        passphrase: api_creds.passphrase,
    };

    const legacyWallet = createLegacyWallet(new ethers.Wallet(decryptPrivateKey(user.private_key)));
    const clobClient = new ClobClient(host, CHAIN_ID, legacyWallet as any, creds);

    const unmatchedOrders = await getUnmatchedOpenOrders(clobClient, user.wallet_address);
    if (!unmatchedOrders) {
        return ctx.reply("❌ Internal Server Error");
    }

    if (unmatchedOrders.length === 0) {
        return ctx.reply("✅ No unmatched open orders found.");
    }

    for (const order of unmatchedOrders) {
        const text = `
🧾 *Open Order*
📊 *Market:* ${order.market}
📈 *Side:* ${order.side}
💰 *Price:* $${parseFloat(order.price).toFixed(4)}
📦 *Size:* ${parseFloat(order.original_size).toFixed(2)}
🎯 *Outcome:* ${order.outcome}
⏱ *Created:* ${new Date(order.created_at).toLocaleString()}
        `.trim();

        const inlineKeyboard = Markup.inlineKeyboard([
            Markup.button.callback("❌ Cancel Order", `cancel_order:${encodeMarketId(order.id)}`),
        ]);

        await ctx.reply(text, {
            parse_mode: "Markdown",
            reply_markup: inlineKeyboard.reply_markup,
        });
    }
}

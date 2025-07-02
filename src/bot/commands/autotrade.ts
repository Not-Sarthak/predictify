import { AUTO_TRADE_MENU_BUTTONS } from "@/bot/ui/buttons";
import { getUserIdFromCtx } from "@/bot/utils";
import {
    checkCopyTradeUserStatus,
    checkWalletCopyTradeStatus,
} from "@/bot/utils/database/check-copy-trade-status";
import { Markup, type Context } from "telegraf";

export async function handleAutoTradeCommand(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);

    const [walletStatusList, userCopyTradeStatus] = await Promise.all([
        await checkWalletCopyTradeStatus(userId.toString()),
        await checkCopyTradeUserStatus(userId.toString()),
    ]);

    if (!walletStatusList) {
        return ctx.reply("No Added Wallets");
    }

    const watchedWalletsCount = walletStatusList.length;

    const statusMessage =
        `🤖 *AutoTrade Menu*\n\n` +
        `👁️ *Monitoring:* ${watchedWalletsCount}/3 Wallets\n\n` +
        `Select an Action:`;

    const walletButtons = walletStatusList.map((wallet) => {
        const emoji = wallet.is_enabled ? "✅" : "🔔";
        const shortAddress =
            wallet.wallet_address.slice(0, 6) + "..." + wallet.wallet_address.slice(-4);
        return [
            Markup.button.callback(
                `${emoji} ${shortAddress}`,
                `toggle_wallet_ct:${wallet.wallet_address}`
            ),
        ];
    });

    const combinedButtons = [
        ...walletButtons,
        [
            Markup.button.callback(
                userCopyTradeStatus ? "❌ Disable CopyTrade" : "✅ Enable CopyTrade",
                `toggle_copy_trade:${!userCopyTradeStatus}`
            ),
        ],
        ...AUTO_TRADE_MENU_BUTTONS,
    ];

    await ctx.editMessageText(statusMessage, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard(combinedButtons).reply_markup,
    });
}

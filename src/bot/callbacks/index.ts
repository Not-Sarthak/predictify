import { Markup, type Context } from "telegraf";

import { handleStartMenuCallbacks } from "@/bot/callbacks/start";
import {
    handleSubscriptionManagement,
    handleSubscriptionMenuCallbacks,
} from "@/bot/callbacks/subscriptions";
import { MAIN_MENU_BUTTONS } from "@/bot/ui/buttons";
import { handleWalletSettingsMenu } from "@/bot/callbacks/settings";
import { handleExportPrivateKey } from "@/bot/utils";

export async function handleCallbackQuery(ctx: Context) {
    const data = (ctx.callbackQuery as any).data as string;

    // Handle Start Menu Callbacks
    if (data.startsWith("start:")) {
        const target = data.split(":")[1];
        return handleStartMenuCallbacks(ctx, target);
    }

    // Handle Subscriptions Menu Callbacks
    if (data.startsWith("subscriptions:")) {
        const target = data.split(":")[1];
        return handleSubscriptionMenuCallbacks(ctx, target);
    }

    // Handle Subscription Management
    if (data.startsWith("subscribe:")) {
        const [isSubscribe, category] = data.split(":").slice(1);
        return handleSubscriptionManagement(ctx, isSubscribe, category);
    }

    // Handle Wallet Settings Menu
    if (data.startsWith("settings:")) {
        const action = data.split(":")[1];
        if (action === "wallet") {
            await ctx.answerCbQuery();
            return handleWalletSettingsMenu(ctx);
        }
    }

    // Handle Exporting Private Key
    if (data.startsWith("export_private_key:")) {
        const network = data.split(":")[1];
        return handleExportPrivateKey(ctx, network as "evm" | "solana");
    }

    if (data === "bridge_funds") {
        await ctx.answerCbQuery();

        // TODO:FIX - HANDLE BRIDGE FUNDS
        // @Not-Sarthak Uncomment this when you add Params
        // const response = await createDebridgeBridgeOrder({});
        // if (!response) {
        //     return ctx.reply("❌ There was a problem bridging your funds.");
        // }

        // return ctx.reply("✅ Funds Successfully Bridged to Polygon.");
    }

    // Handles Going back to Main Menu
    if (data === "back_to_main_menu") {
        return ctx.editMessageReplyMarkup(Markup.inlineKeyboard(MAIN_MENU_BUTTONS).reply_markup);
    }

    // Handle Close Messaage
    if (data === "close_message") {
        return ctx.deleteMessage();
    }

    return ctx.answerCbQuery();
}

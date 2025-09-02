import { generateTranslatedSubscriptionMenuButtons } from "../ui/buttons";
import { Markup, type Context } from "telegraf";
import { getUserIdFromCtx } from "../utils";
import { getUserLanguage } from "../../helpers/user-language";
import { getMessages } from "../../i18n";

export async function handleSubscriptionsCommand(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);
    const language = await getUserLanguage(userId);
    const t = getMessages(language);

    const translatedButtons = generateTranslatedSubscriptionMenuButtons(language);
    const keyboard = Markup.inlineKeyboard(translatedButtons);

    ctx.reply(`📋 ${t.chooseSubscriptionOption}:`, keyboard);
}

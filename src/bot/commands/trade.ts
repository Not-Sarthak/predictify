import { Markup, type Context } from "telegraf";
import { generateTradeMenuButtons } from "../ui/buttons/menu";
import { getUserIdFromCtx } from "../utils";
import { getUserLanguage } from "../../helpers/user-language";
import { t } from "../../i18n";

export async function handleTradeCommand(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);
    const language = await getUserLanguage(userId);
    const keyboard = Markup.inlineKeyboard(generateTradeMenuButtons(language));

    return ctx.reply(t("chooseTradingOption", language), keyboard);
}

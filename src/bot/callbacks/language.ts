import { Markup, type Context } from "telegraf";
import { getUserIdFromCtx } from "../utils";
import { getUserLanguage, updateUserLanguage } from "../../helpers/user-language";
import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES, type SupportedLanguage } from "../../i18n";
import { addTranslationToContext } from "../../utils/translation-middleware";
import { setBotCommandsForUser } from "../index";

/**
 * Show language settings menu
 */
export async function handleLanguageSettings(ctx: Context) {
    const userId = getUserIdFromCtx(ctx);
    const currentLanguage = await getUserLanguage(userId);
    const { t } = await addTranslationToContext(ctx);

    const languageButtons = SUPPORTED_LANGUAGES.map((lang) => {
        const emoji = lang === currentLanguage ? "✅" : "";
        const name = LANGUAGE_NAMES[lang];
        return [Markup.button.callback(`${emoji} ${name}`, `set_language:${lang}`)];
    });

    const keyboard = Markup.inlineKeyboard([
        ...languageButtons,
        [Markup.button.callback(t("back"), "main_menu")],
        [Markup.button.callback(t("close"), "close_message")],
    ]);

    const message = `${t("languageSettings")}\n\n${t("switchLanguage")}:`;

    if (ctx.updateType === "callback_query") {
        try {
            return await ctx.editMessageText(message, {
                reply_markup: keyboard.reply_markup,
            });
        } catch (error: any) {
            // Handle "message is not modified" error gracefully
            if (
                error?.response?.error_code === 400 &&
                error?.response?.description?.includes("message is not modified")
            ) {
                // Message content is the same, just answer the callback query
                return ctx.answerCbQuery();
            }
            // Re-throw other errors
            throw error;
        }
    }

    return ctx.reply(message, {
        reply_markup: keyboard.reply_markup,
    });
}

/**
 * Handle language selection
 */
export async function handleLanguageSelection(ctx: Context, language: string) {
    const userId = getUserIdFromCtx(ctx);
    const currentLanguage = await getUserLanguage(userId);

    // Validate language
    if (!SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)) {
        return ctx.answerCbQuery("❌ Invalid language selection");
    }

    // Check if user selected the same language they already have
    if (language === currentLanguage) {
        return ctx.answerCbQuery("✅ Language already selected");
    }

    // Update user's language preference
    const result = await updateUserLanguage(userId, language as SupportedLanguage);

    if (!result.success) {
        return ctx.answerCbQuery("❌ Failed to update language");
    }

    // Update bot commands for this user with their new language
    setBotCommandsForUser(userId).catch(console.error);

    // Get translation context with new language
    const { t } = await addTranslationToContext(ctx);

    await ctx.answerCbQuery(t("languageUpdated"));

    // Refresh the language settings menu to show the new selection
    return handleLanguageSettings(ctx);
}

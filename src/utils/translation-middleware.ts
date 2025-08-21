import type { Context } from "telegraf";
import { getUserIdFromCtx } from "../bot/utils";
import { getUserLanguage } from "../helpers/user-language";
import { t, type SupportedLanguage, type LocaleMessages } from "../i18n";

/**
 * Translation context interface
 */
export interface TranslationContext {
    t: (key: keyof LocaleMessages) => string;
    language: SupportedLanguage;
}

/**
 * Middleware to add translation functions to the context
 */
export async function addTranslationToContext(ctx: Context): Promise<TranslationContext> {
    const userId = getUserIdFromCtx(ctx);
    const language = await getUserLanguage(userId);

    const translate = (key: keyof LocaleMessages): string => {
        return t(key, language);
    };

    return {
        t: translate,
        language,
    };
}

/**
 * Helper function to get translated text for a user
 */
export async function getTranslatedText(
    userId: number,
    key: keyof LocaleMessages
): Promise<string> {
    const language = await getUserLanguage(userId);
    return t(key, language);
}

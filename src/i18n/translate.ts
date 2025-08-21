import { en, zh, type SupportedLanguage } from "./locales/index";
import type { LocaleMessages } from "./types";

const locales: Record<SupportedLanguage, LocaleMessages> = {
    en,
    zh,
};

/**
 * Get translated message for the given key and language
 */
export function t(key: keyof LocaleMessages, language: SupportedLanguage = "en"): string {
    const locale = locales[language] || locales.en;
    return locale[key] || locales.en[key] || key;
}

/**
 * Get all messages for a specific language
 */
export function getMessages(language: SupportedLanguage): LocaleMessages {
    return locales[language] || locales.en;
}

/**
 * Check if language is supported
 */
export function isSupportedLanguage(language: string): language is SupportedLanguage {
    return language === "en" || language === "zh";
}

// Re-export the SupportedLanguage type
export type { SupportedLanguage } from "./locales/index";

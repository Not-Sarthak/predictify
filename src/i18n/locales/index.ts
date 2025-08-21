export { en } from "./en";
export { zh } from "./zh";

export type SupportedLanguage = "en" | "zh";

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ["en", "zh"];

export const LANGUAGE_NAMES = {
    en: "English",
    zh: "中文",
} as const;

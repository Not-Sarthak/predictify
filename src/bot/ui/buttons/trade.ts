import { Markup } from "telegraf";
import { getUserLanguage } from "../../../helpers/user-language";
import { t } from "../../../i18n";

export const generateClosePositionButton = (marketId: string) => {
    return Markup.button.callback("💵 Close Position", `close_position:${marketId}`);
};

export const generateTranslatedClosePositionButton = async (marketId: string, userId: number) => {
    const language = await getUserLanguage(userId);
    return Markup.button.callback(t("closePosition", language), `close_position:${marketId}`);
};

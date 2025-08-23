import { Markup } from "telegraf";
import { getUserLanguage } from "../../../helpers/user-language";
import { getMarketCategoryText } from "../../../utils/message-formatters";

export function generateSubscriptionButtons(
    category: readonly string[],
    action: "subscribe" | "unsubscribe"
) {
    const isSubscribe = action === "subscribe";

    const buttons = category.map((cat) =>
        Markup.button.callback(
            `${isSubscribe ? "🔔" : "🔕"} ${cat}`,
            `subscribe:${isSubscribe ? "yes" : "no"}:${cat}`
        )
    );

    const layout = [];
    for (let i = 0; i < buttons.length; i += 2) {
        layout.push(buttons.slice(i, i + 2));
    }

    return layout;
}

export async function generateTranslatedSubscriptionButtons(
    categories: readonly string[],
    action: "subscribe" | "unsubscribe",
    userId: number
) {
    const language = await getUserLanguage(userId);
    const isSubscribe = action === "subscribe";

    const buttons = categories.map((cat) => {
        const translatedCategory = getMarketCategoryText(cat, language);
        return Markup.button.callback(
            `${isSubscribe ? "🔔" : "🔕"} ${translatedCategory}`,
            `subscribe:${isSubscribe ? "yes" : "no"}:${cat}`
        );
    });

    const layout = [];
    for (let i = 0; i < buttons.length; i += 2) {
        layout.push(buttons.slice(i, i + 2));
    }

    return layout;
}

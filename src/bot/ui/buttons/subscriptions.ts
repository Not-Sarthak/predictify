import { Markup } from "telegraf";

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

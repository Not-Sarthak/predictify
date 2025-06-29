import { Markup } from "telegraf";
import { CATEGORY_LIST } from "@/shared/constants";

function generateSubscriptionButtons(action: "subscribe" | "unsubscribe") {
    const isSubscribe = action === "subscribe";

    const buttons = CATEGORY_LIST.map((cat) =>
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

export const SUBSCRIBE_BUTTONS = generateSubscriptionButtons("subscribe");

export const UNSUBSCRIBE_BUTTONS = generateSubscriptionButtons("unsubscribe");

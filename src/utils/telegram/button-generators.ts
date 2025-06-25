import { Markup } from "telegraf";
import { CATEGORY_LIST } from "../../constants/polymarket";

export function generateSubscriptionButtons(action: "subscribe" | "unsubscribe") {
    const buttons = CATEGORY_LIST.map((cat) =>
        Markup.button.callback(`${action === "subscribe" ? "🔔" : "🔕"} ${cat}`, `${action}_${cat}`)
    );

    const layout = [];
    for (let i = 0; i < buttons.length; i += 2) {
        layout.push(buttons.slice(i, i + 2));
    }

    return layout;
}

export function generateMainMenuButtons() {
    return [
        [
            {
                text: "🔔 Subscriptions",
                callback_data: `start_subscriptions`,
            },
            {
                text: "🔥 Trade",
                callback_data: `start_trade`,
            },
        ],
        [
            {
                text: "🤖 AutoTrade",
                callback_data: `start_autotrade`,
            },
            {
                text: "⚙️ Settings",
                callback_data: `start_settings`,
            },
        ],
    ];
}

export function generateTradeButtons(marketId: string) {
    return [
        [
            {
                text: "Buy Yes ✅",
                callback_data: `buy_yes:${marketId}`,
            },
            {
                text: "Buy No ❌",
                callback_data: `buy_no:${marketId}`,
            },
        ],
    ];
}

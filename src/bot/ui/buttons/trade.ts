import { Markup } from "telegraf";

export const generateTradeButtons = (marketId: string) => {
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
};

export const generateClosePositionButton = (marketId: string) => {
    return Markup.button.callback("💵 Close Position", `close_position:${marketId}`);
};

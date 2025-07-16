import { Markup } from "telegraf";

export const generateClosePositionButton = (marketId: string) => {
    return Markup.button.callback("💵 Close Position", `close_position:${marketId}`);
};

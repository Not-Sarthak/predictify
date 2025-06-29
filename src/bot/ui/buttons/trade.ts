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

import { describe, expect, test } from "bun:test";
import { getUserFills, type WsTradeMessage } from "./fills";

const USER_KEY = "user-api-key";

const makerOrder = (owner: string, matched: string, overrides = {}) => ({
    order_id: `order-${owner}-${matched}`,
    owner,
    matched_amount: matched,
    price: "0.40",
    asset_id: "yes-token",
    outcome: "Yes",
    side: "BUY",
    ...overrides,
});

const trade = (overrides: Partial<WsTradeMessage> = {}): WsTradeMessage => ({
    id: "trade-1",
    taker_order_id: "taker-order",
    asset_id: "yes-token",
    side: "SELL",
    size: "250",
    price: "0.40",
    outcome: "Yes",
    maker_orders: [],
    ...overrides,
});

describe("getUserFills", () => {
    test("a resting limit order only gets its own matched amount, not the whole trade", () => {
        const fills = getUserFills(
            trade({
                maker_orders: [makerOrder("someone-else", "200"), makerOrder(USER_KEY, "50")],
            }),
            USER_KEY
        );

        expect(fills).toHaveLength(1);
        expect(fills[0]).toMatchObject({ side: "BUY", shares: 50, price: 0.4, outcome: "Yes" });
    });

    test("uses the maker order's own side and asset when matched against the other outcome", () => {
        const fills = getUserFills(
            trade({
                side: "BUY",
                maker_orders: [
                    makerOrder(USER_KEY, "30", {
                        asset_id: "no-token",
                        outcome: "No",
                        price: "0.60",
                    }),
                ],
            }),
            USER_KEY
        );

        expect(fills[0]).toMatchObject({
            assetId: "no-token",
            outcome: "No",
            side: "BUY",
            shares: 30,
            price: 0.6,
        });
    });

    test("falls back to the taker side when none of the maker orders belong to the user", () => {
        const fills = getUserFills(
            trade({ side: "BUY", maker_orders: [makerOrder("someone-else", "250")] }),
            USER_KEY
        );

        expect(fills).toEqual([
            {
                orderId: "taker-order",
                assetId: "yes-token",
                side: "BUY",
                outcome: "Yes",
                shares: 250,
                price: 0.4,
            },
        ]);
    });

    test("drops zero and malformed sizes", () => {
        expect(getUserFills(trade({ size: "0" }), USER_KEY)).toEqual([]);
        expect(getUserFills(trade({ size: "abc" }), USER_KEY)).toEqual([]);
        expect(
            getUserFills(trade({ maker_orders: [makerOrder(USER_KEY, "0")] }), USER_KEY)
        ).toEqual([]);
    });
});

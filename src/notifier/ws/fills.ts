interface WsMakerOrder {
    order_id: string;
    owner: string;
    matched_amount: string;
    price: string;
    asset_id: string;
    outcome: string;
    side: string;
}

export interface WsTradeMessage {
    id: string;
    taker_order_id: string;
    asset_id: string;
    side: string;
    size: string;
    price: string;
    outcome: string;
    maker_orders?: WsMakerOrder[];
}

export interface UserFill {
    orderId: string;
    assetId: string;
    side: "BUY" | "SELL";
    outcome: string;
    shares: number;
    price: number;
}

const toSide = (side: string): UserFill["side"] => (side.toUpperCase() === "SELL" ? "SELL" : "BUY");

// A trade on the user channel can match several makers against one taker. The user's part of it
// is their own maker orders if they were resting on the book, otherwise the taker side.
export function getUserFills(trade: WsTradeMessage, apiKey: string): UserFill[] {
    const makerFills = (trade.maker_orders ?? [])
        .filter((order) => order.owner === apiKey)
        .map((order) => ({
            orderId: order.order_id,
            assetId: order.asset_id,
            side: toSide(order.side),
            outcome: order.outcome,
            shares: Number(order.matched_amount),
            price: Number(order.price),
        }));

    if (makerFills.length) return makerFills.filter((fill) => fill.shares > 0);

    const takerFill: UserFill = {
        orderId: trade.taker_order_id,
        assetId: trade.asset_id,
        side: toSide(trade.side),
        outcome: trade.outcome,
        shares: Number(trade.size),
        price: Number(trade.price),
    };

    return takerFill.shares > 0 ? [takerFill] : [];
}

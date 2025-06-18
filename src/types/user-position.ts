export interface UserPositionRequest {
    user: string;
    market?: string;
    sizeThreshold?: number;
    redeemable?: boolean;
    mergeable?: boolean;
    title?: string;
    eventId?: string;
    limit?: number;
    offset?: number;
    sortBy?: "TOKENS" | "CURRENT" | "INITIAL" | "CASHPNL" | "PERCENTPNL" | "TITLE" | "RESOLVING" | "PRICE";
    sortDirection?: "ASC" | "DESC";
}

export interface UserPositionResponse {
    proxyWallet: string;
    asset: string;
    conditionId: string;
    size: number;
    avgPrice: number;
    initialValue: number;
    currentValue: number;
    cashPnl: number;
    percentPnl: number;
    totalBought: number;
    realizedPnl: number;
    percentRealizedPnl: number;
    curPrice: number;
    redeemable: boolean;
    mergeable: boolean;
    title: string;
    slug: string;
    icon: string;
    eventSlug: string;
    outcome: string;
    outcomeIndex: number;
    oppositeOutcome: string;
    oppositeAsset: string;
    endDate: string;
    negativeRisk: boolean;
}
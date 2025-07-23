import type { ContractConfig } from "@polymarket/clob-client";

export const POLYMARKET_WS_USER_URL = `wss://ws-subscriptions-clob.polymarket.com/ws/user`;
export const POLYMARKET_WS_MARKET_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";

export const HOST = "https://clob.polymarket.com";
export const CHAIN_ID = 137;

export const CATEGORY_LIST = [
    "Crypto",
    "Breaking-News",
    "Geo-Politics",
    "Trump",
    "Elon-Musk",
    "Sports",
    "Politics",
    "Tech",
    "Business",
    "Economy",
    "Pop-Culture",
    "Science",
] as const;

export const ZERO_DTE_MARKETS_CATEGORY_LIST = ["Bitcoin", "Ethereum", "Solana", "XRP", "Dogecoin"];

export const AMOY_CONTRACTS: ContractConfig = {
    exchange: "0xdFE02Eb6733538f8Ea35D585af8DE5958AD99E40",
    negRiskAdapter: "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296",
    negRiskExchange: "0xC5d563A36AE78145C45a50134d48A1215220f80a",
    collateral: "0x9c4e1703476e875070ee25b56a58b008cfb8fa78",
    conditionalTokens: "0x69308FB512518e39F9b16112fA8d994F4e2Bf8bB",
};

export const MATIC_CONTRACTS: ContractConfig = {
    exchange: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E",
    negRiskAdapter: "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296",
    negRiskExchange: "0xC5d563A36AE78145C45a50134d48A1215220f80a",
    collateral: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    conditionalTokens: "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045",
};

export const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // USDC on Polygon
export const EXCHANGE_ADDRESS = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E"; // Polymarket Exchange Contract

export const MARKET_FILTERS = ["💧 Volume", "🆕 Newest", "⏳ Ending Soon"];

export const HALF_DAY_IN_MS = 12 * 60 * 60 * 1000;

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

export const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // USDC on Polygon
export const EXCHANGE_ADDRESS = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E"; // Polymarket Exchange Contract

export const MARKET_FILTERS = ["💧 Volume", "🆕 Newest", "⏳ Ending Soon"];

export const HALF_DAY_IN_MS = 12 * 60 * 60 * 1000;

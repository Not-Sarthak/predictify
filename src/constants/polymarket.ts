import type { ContractConfig } from "@polymarket/clob-client";

export const HOST = "https://clob.polymarket.com";
export const PRIVATE_KEY =
  "0xeab6ea12ac89da994f74828b4e0a2a4b71798390a4ce4bb67d568760b8cb6df5";
export const CHAIN_ID = 137;

export const CATEGORY_LIST = [
  "Art",
  "Business",
  "Crypto",
  "Politics",
  "Pop-Culture",
  "Science",
  "Sports",
  "Tech",
];

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
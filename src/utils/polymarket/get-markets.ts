import { ClobClient, type ApiKeyCreds } from "@polymarket/clob-client";
import axios from "axios";
import { createLegacyWallet } from "../../constants/legacy-ethers";
import { CHAIN_ID } from "../../constants/polymarket";
import { CLOB_API_URL } from "../../config/env";
import { ethers } from "ethers";

interface Market {
  id: string;
  ticker: string;
  slug: string;
  title: string;
  description: string;
  resolutionSource: string;
  startDate: string;
  creationDate: string;
  endDate: string;
  image: string;
  icon: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  new: boolean;
  featured: boolean;
  restricted: boolean;
  liquidity: number;
  volume: number;
  openInterest: number;
  sortBy?: string;
  createdAt: string;
  updatedAt: string;
  competitive: number;
  volume24hr: number;
  volume1wk: number;
  volume1mo: number;
  volume1yr: number;
  enableOrderBook: boolean;
  liquidityClob: number;
  negRisk?: boolean;
  negRiskMarketID?: string;
  commentCount: number;
  markets: any[];
  series?: any[];
  tags: any[];
  cyom: boolean;
  showAllOutcomes: boolean;
  showMarketImages: boolean;
  enableNegRisk: boolean;
  automaticallyActive: boolean;
  seriesSlug?: string;
  gmpChartMode?: string;
  negRiskAugmented: boolean;
  pendingDeployment: boolean;
  deploying: boolean;
  deployingTimestamp?: string;
}

// Get All Markets
export async function fetchMarkets(): Promise<Market[]> {
  const res = await axios.get(
    "https://gamma-api.polymarket.com/events/pagination?limit=20&active=true&archived=false&tag_slug=politics&closed=false&order=volume24hr&ascending=false&offset=0"
  );
  const markets = res.data.data;
  return markets;
}

// fetchMarkets().then((markets) => {
//   console.log(markets);
// });

// Get Market by Slug
export async function getMarketBySlug(slug: string) {
  try {
    const response = await fetch(
      `https://gamma-api.polymarket.com/markets?slug=${slug}`
    );
    const markets = await response.json();

    if (markets && markets.length > 0) {
      const market = markets[0];
      return {
        conditionId: market.conditionId,
        marketInfo: market,
      };
    }
  } catch (error) {
    console.error("Error fetching market:", error);
    throw error;
  }
}

// getMarketBySlug("us-iran-nuclear-deal-before-july").then((result) => {
//   console.log("Condition ID:", result?.conditionId);
//   return getTokenIdsForMarket(result?.conditionId);
// });

export async function getTokenIdsForMarket(conditionId: string): Promise<any> {
  try {
    const response = await fetch(
      `https://gamma-api.polymarket.com/markets?condition_ids=${conditionId}`
    );
    const markets = await response.json();

    if (markets && markets.length > 0) {
      const market = markets[0];
      const tokenIds = JSON.parse(market.clobTokenIds);
      return {
        yesTokenId: tokenIds[0],
        noTokenId: tokenIds[1],
        marketInfo: market,
      };
    }
  } catch (error) {
    console.error("Error Fetching Token IDs for Market:", error);
    throw error;
  }
}

// getTokenIdsForMarket("0x896d1877ca71ffa3d43c046fdacd4470f1a8c0cf91e14ed66d9d0e0b3099dfe5").then((result) => {
//   console.log(result?.yesTokenId);
//   console.log(result?.noTokenId);
// });

interface GetMarketsRequest {
  privateKey: string;
  creds: ApiKeyCreds;
}

export async function getMarkets(getMarketsRequest: GetMarketsRequest) {
  const wallet = new ethers.Wallet(getMarketsRequest.privateKey);
  const clobClient = new ClobClient(
    CLOB_API_URL,
    CHAIN_ID,
    createLegacyWallet(wallet) as any,
    getMarketsRequest.creds
  );
  const response = await clobClient.getMarkets();
  return response;
}

// Get Events By Slug
export async function getEventsBySlug(slug: string): Promise<any> {
  const options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  };

  const response = await fetch(
    `https://gamma-api.polymarket.com/events?slug=${slug}`,
    options
  );
  const data = await response.json();
  return data;
}

// getEventsBySlug("nyc-mayoral-dem-primary-mamdani-mov").then((result) => {
//   console.log(result);
// });

interface GetMarketOrderBookRequest {
  tokenId: string[];
  privateKey: string;
  creds: ApiKeyCreds;
}

export async function getMarketOrderBook(
  getMarketOrderBookRequest: GetMarketOrderBookRequest
): Promise<any> {
  const wallet = new ethers.Wallet(getMarketOrderBookRequest.privateKey);

  const host = "https://clob.polymarket.com";
  const chainId = 137;

  const clobClient = new ClobClient(
    host,
    chainId,
    createLegacyWallet(wallet) as any,
    getMarketOrderBookRequest.creds
  );

  const yesResponse = await clobClient.getOrderBook(
    getMarketOrderBookRequest.tokenId[0]
  );

  const noResponse = await clobClient.getOrderBook(
    getMarketOrderBookRequest.tokenId[1]
  );

  return { yesResponse, noResponse };
}

getMarketOrderBook({
  tokenId: ["25009308950201377351599447846248861147611469669632550804193755818060327719237"],
  privateKey: "0x68afd4e25df9f64382038e4aae0ec7ba4a9833c1079dc1521538656a9d2ef1c3",
  creds: {
    key: "f3e137a7-3a85-d6fa-292a-3db867dcd441",
    secret: "8qfO6fgz14qvKZPKO-74PRuepSbaexlJLVtscoPnsLY=",
    passphrase: "d1294f22392578c29e9caaeac0ae40bcc2c37a75578bdf78dafd38178bc25a9e",
  },
});
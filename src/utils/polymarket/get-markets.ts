import axios from "axios";
import { getTokenIdsForMarket } from "./get-current-market-details";

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
async function getMarketBySlug(slug: string) {
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


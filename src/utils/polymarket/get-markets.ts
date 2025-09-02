import { ClobClient, type ApiKeyCreds } from "@polymarket/clob-client";
import axios from "axios";
import { clearCache, createLegacyWallet, getOrSetCache } from "../../utils";
import { ethers } from "ethers";
import { redisClient } from "../../lib/redis";

export interface Market {
    id: string;
    ticker: string;
    slug: string;
    title: string;
    question: string;
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
    events: any[];
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
    acceptingOrders: boolean;
    outcomePrices: string; // JSON string array of prices
    clobTokenIds: string; // JSON string array of token IDs
}

type SlimMarket = Omit<Market, "markets" | "series" | "tags">;

// Get All Markets
export async function fetchMarkets(
    category: string,
    filter: string,
    offset: number,
    useCache: boolean = true
): Promise<SlimMarket[]> {
    const BASE_URL = "https://gamma-api.polymarket.com/events/pagination";
    const LIMIT = 8;
    const OFFSET = offset;

    if (category === "geo-politics") category = "geopolitics";

    const params = new URLSearchParams({
        limit: LIMIT.toString(),
        offset: OFFSET.toString(),
        active: "true",
        archived: "false",
        closed: "false",
        tag_slug: category,
        ascending: "false",
    });

    const now = new Date();
    const endOfWindow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    let manualSortFn: ((a: Market, b: Market) => number) | null = null;

    switch (filter) {
        case "volume":
            params.set("order", "volume1mo");
            break;

        case "newest":
            params.set("order", "startDate");
            params.set("ascending", "true");
            manualSortFn = (a, b) => b.volume1mo - a.volume1mo;
            break;

        case "ending":
            params.set("order", "endDate");
            params.set("ascending", "true");
            manualSortFn = (a, b) => b.volume1mo - a.volume1mo;
            break;

        case "0dte":
            params.set("end_date_min", now.toISOString());
            params.set("end_date_max", endOfWindow.toISOString());
            params.set("order", "volume24hr");
            break;

        default:
            params.set("order", "volume1mo");
    }

    const url = `${BASE_URL}?${params.toString()}`;
    const cacheKey = `markets:${category}:${filter}:${OFFSET}`;

    const fetchFn = async (): Promise<SlimMarket[]> => {
        const res = await axios.get(url);
        const markets: Market[] = res.data.data;

        if (manualSortFn) {
            markets.sort(manualSortFn);
        }

        // Remove heavy keys before caching
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const slimmed = markets.map(({ markets, series, tags, ...rest }) => rest);
        return slimmed;
    };

    const CACHE_TIME = 300;

    if (useCache) {
        return await getOrSetCache(cacheKey, fetchFn, CACHE_TIME);
    } else {
        await clearCache(cacheKey);
        const fresh = await fetchFn();
        await redisClient.setEx(cacheKey, CACHE_TIME, JSON.stringify(fresh));
        return fresh;
    }
}

// Get Event by Slug
export async function getEventBySlug(slug: string) {
    try {
        const response = await fetch(
            `https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(slug)}`
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
    }
}

// Get Events By Slug
export async function getEventsBySlug(slug: string): Promise<any> {
    const options = {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    };

    const response = await fetch(`https://gamma-api.polymarket.com/events?slug=${slug}`, options);
    const data = await response.json();
    return data;
}

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

    const [yesResponse, noResponse] = await Promise.all([
        clobClient.getOrderBook(getMarketOrderBookRequest.tokenId[0]),
        clobClient.getOrderBook(getMarketOrderBookRequest.tokenId[1]),
    ]);

    return { yesResponse, noResponse };
}

export async function getMarketById(marketId: string) {
    try {
        const response = await fetch(`https://gamma-api.polymarket.com/markets?id=${marketId}`);
        const data = await response.json();
        const market = data[0];

        return market;
    } catch (error) {
        console.error("Error fetching Market: ", error);
        return null;
    }
}

export async function getMarketByConditionId(conditionId: string) {
    try {
        const response = await fetch(
            `https://gamma-api.polymarket.com/markets?condition_ids=${conditionId}`
        );
        const json = await response.json();
        return json[0] ?? null;
    } catch (error) {
        console.error("Error fetching Market Details: ", error);
        return null;
    }
}

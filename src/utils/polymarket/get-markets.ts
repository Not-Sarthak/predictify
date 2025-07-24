import { ClobClient, type ApiKeyCreds } from "@polymarket/clob-client";
import axios from "axios";
import { createLegacyWallet } from "../../utils";
import { CHAIN_ID } from "../../shared/constants";
import { env } from "../../config/env";
import { ethers } from "ethers";

interface Market {
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
}

// Get All Markets
export async function fetchMarkets(
    category: string,
    filter: string,
    offset: number
): Promise<Market[]> {
    const BASE_URL = "https://gamma-api.polymarket.com/events/pagination";
    const LIMIT = 8;
    const OFFSET = offset;

    let url = "";
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
    const tomorrowEnd = new Date(now);
    tomorrowEnd.setDate(now.getDate() + 1);
    tomorrowEnd.setHours(0);

    switch (filter) {
        case "volume":
            params.set("order", "volume1mo");
            break;
        case "newest":
            params.set("order", "startDate");
            break;
        case "ending":
            params.set("order", "endDate");
            break;
        case "0dte":
            params.set("end_date_min", now.toISOString());
            params.set("end_date_max", tomorrowEnd.toISOString());
            params.set("order", "endDate");
            break;
        default:
            params.set("order", "volume1mo");
    }

    url = `${BASE_URL}?${params.toString()}`;

    const res = await axios.get(url);
    return res.data.data;
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
        env.CLOB_API_URL,
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

    const response = await fetch(`https://gamma-api.polymarket.com/events?slug=${slug}`, options);
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

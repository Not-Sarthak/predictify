// // import { ClobClient, Side, OrderType } from "@polymarket/clob-client";
// // import { ethers } from "ethers";

// // interface ApiKeyCreds {
// // key: string;
// // secret: string;
// // passphrase: string;
// // }

// // async function placeSingleOrder(
// // tokenId: string,
// // price: number,
// // size: number,
// // side: Side,
// // orderType: OrderType = OrderType.GTC
// // ) {
// // const creds: ApiKeyCreds = {
// // key: "6c76fca3-52ae-84de-8634-cd66dd7a16ca",
// // secret: "dAT_ZElftoTcs7ONpQvZJK42BSFS7Dot5WYSKntM8Pk=",
// // passphrase: "4ae7b7f36a1b68e8bfce790c06f13c8983a0923644514c003fee30927525b7e3",
// // };

// // const privateKey = "0xeab6ea12ac89da994f74828b4e0a2a4b71798390a4ce4bb67d568760b8cb6df5";
// // if (!privateKey) {
// // throw new Error("PRIVATE_KEY not found");
// // }

// // const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
// // const wallet = new ethers.Wallet(privateKey, provider);

// // // Create a v5 compatible wallet wrapper
// // const walletWithLegacyMethods = {
// // ...wallet,
// // \_signTypedData: async (domain: any, types: any, value: any) => {
// // try {
// // const { EIP712Domain, ...typesWithoutDomain } = types;
// // return await wallet.signTypedData(domain, typesWithoutDomain, value);
// // } catch (error) {
// // console.error("Signing error:", error);
// // throw error;
// // }
// // },
// // getAddress: async () => wallet.address,
// // signMessage: async (message: string) => wallet.signMessage(message),
// // provider: provider
// // };

// // try {
// // const host = "https://clob.polymarket.com";
// // const chainId = 137; // Polygon mainnet

// // const clobClient = new ClobClient(
// // host,
// // chainId,
// // walletWithLegacyMethods as any,
// // creds
// // );

// // const order = await clobClient.createOrder({
// // tokenID: tokenId,
// // price: price,
// // side: side,
// // size: size,
// // feeRateBps: 0,
// // nonce: 0,
// // });

// // console.log("Created Order:", order);

// // const response = await clobClient.postOrder(order, orderType);
// // console.log("Order Response:", response);
// // return response;

// // } catch (error) {
// // console.error("Error placing order:", error);
// // throw error;
// // }
// // }

// // async function getTokenIdsForMarket(conditionId: string) {
// // try {
// // const response = await fetch(`https://gamma-api.polymarket.com/markets?condition_ids=${conditionId}`);
// // const markets = await response.json();

// // if (markets && markets.length > 0) {
// // const market = markets[0];
// // // Parse the clobTokenIds string into an array
// // const tokenIds = JSON.parse(market.clobTokenIds);
// // return {
// // yesTokenId: tokenIds[0],
// // noTokenId: tokenIds[1],
// // marketInfo: market
// // };
// // }

// // throw new Error("Market not found");
// // } catch (error) {
// // console.error("Error fetching market data:", error);
// // throw error;
// // }
// // }

// // async function placeOrderWithTokenLookup() {
// // const marketId = "0xf2a89afeddff5315e37211b0b0e4e93ed167fba2694cd35c252672d0aca73711";

// // try {
// // // First, get the token IDs for this market
// // const tokenInfo = await getTokenIdsForMarket(marketId);
// // console.log("Token Info:", tokenInfo);

// // if (!tokenInfo.yesTokenId) {
// // throw new Error("YES token ID not found for this market");
// // }

// // // Place a buy order for YES tokens
// // const result = await placeSingleOrder(
// // tokenInfo.yesTokenId,
// // 0.55, // Price: $0.55
// // 10, // Size: 10 tokens
// // Side.BUY, // Buy order
// // OrderType.GTC // Good Till Cancelled
// // );

// // console.log("Order placed successfully:", result);
// // return result;

// // } catch (error) {
// // console.error("Failed to place order:", error);
// // throw error;
// // }
// // }

// // // Run the order placement
// // placeOrderWithTokenLookup()
// // .then(() => console.log("Order placement completed"))
// // .catch(error => console.error("Order placement failed:", error));

// import { ClobClient } from "@polymarket/clob-client"
// import { ethers } from "ethers"
// import type { APIKeyRequest } from "./src/types/api-key"

// export async function generateAPIKey(request: APIKeyRequest) {
// const provider = new ethers.JsonRpcProvider(request.host)
// const wallet = new ethers.Wallet(request.privateKey as any, provider)

// const walletWithLegacyMethods = {
// ...wallet,
// \_signTypedData: async (domain: any, types: any, value: any) => {
// const { EIP712Domain, ...typesWithoutDomain } = types;
// return await wallet.signTypedData(domain, typesWithoutDomain, value);
// },
// getAddress: async () => wallet.address,
// signMessage: async (message: string) => wallet.signMessage(message),
// provider: provider
// }

// const client = new ClobClient(request.host, request.chainId, walletWithLegacyMethods as any)

// try {
// const apiKey = await client.deriveApiKey()
// console.log('API Key:', apiKey)
// } catch (error) {
// console.error('Error:', error)
// }
// }

// generateAPIKey({
// host: "https://clob.polymarket.com",
// privateKey: 0xeab6ea12ac89da994f74828b4e0a2a4b71798390a4ce4bb67d568760b8cb6df5 as any,
// chainId: 137
// })

---

import axios from "axios";

async function fetchMarkets() {
const res = await axios.get('https://gamma-api.polymarket.com/events/pagination?limit=20&active=true&archived=false&tag_slug=politics&closed=false&order=volume24hr&ascending=false&offset=0');
const markets = res.data.data[0];
console.log(markets)
}

fetchMarkets().catch(console.error);

// https://gamma-api.polymarket.com/comments?get_positions=true&get_reports=true&parent_entity_type=Event&parent_entity_id=27196&ascending=false&holders_only=false&order=createdAt&limit=40&offset=0

// https://polymarket.com/api/events/search?_c=all&_q=bitcoi&_p=1
// https://polymarket.com/api/events/search?_c=all&_q=tru&_p=1

generateAPIKey({
host: "https://clob.polymarket.com",
privateKey: "0xeab6ea12ac89da994f74828b4e0a2a4b71798390a4ce4bb67d568760b8cb6df5",
chainId: 137
})

------WS-------
// Types
interface Token {
token_id: string;
outcome: string;
}

interface Market {
condition_id: string;
tokens: Token[];
question: string;
market_slug: string;
active: boolean;
closed: boolean;
}

interface MarketsResponse {
data: Market[];
next_cursor: string;
count: number;
limit: number;
}

interface GammaMarket {
id: number;
slug: string;
clob_token_ids?: string[];
condition_ids?: string[];
active: boolean;
closed: boolean;
}

interface Auth {
apiKey: string;
secret: string;
passphrase: string;
}

const MARKET_CHANNEL = "market";
const USER_CHANNEL = "user";

class WebSocketOrderBook {
private ws: WebSocket;
private channelType: string;
private baseUrl: string;
private data: string[];
private auth: Auth | null;
private verbose: boolean;
private pingInterval: NodeJS.Timeout | null = null;

constructor(
channelType: string,
url: string,
data: string[],
auth: Auth | null,
messageCallback: ((message: string) => void) | null,
verbose: boolean
) {
this.channelType = channelType;
this.baseUrl = url;
this.data = data.filter(id => id); // Filter out empty strings
this.auth = auth;
this.verbose = verbose;

    // Construct WebSocket URL
    const wsUrl = `${url}/ws/${channelType}`;
    if (this.verbose) {
      console.log(`[${this.channelType}] Connecting to ${wsUrl}`);
    }

    // Initialize WebSocket
    this.ws = new WebSocket(wsUrl);
    this.setupWebSocket();

}

private setupWebSocket() {
this.ws.onopen = () => {
if (this.verbose) {
console.log(`[${this.channelType}] Connected to ${this.baseUrl}`);
}

      // Send subscription message
      if (this.channelType === MARKET_CHANNEL) {
        const message = {
          assets_ids: this.data,
          type: MARKET_CHANNEL
        };
        this.ws.send(JSON.stringify(message));
        if (this.verbose) {
          console.log(`[${this.channelType}] Sent market subscription:`, message);
        }
      } else if (this.channelType === USER_CHANNEL && this.auth) {
        const message = {
          markets: this.data,
          type: USER_CHANNEL,
          auth: this.auth
        };
        this.ws.send(JSON.stringify(message));
        if (this.verbose) {
          console.log(`[${this.channelType}] Sent user subscription:`, message);
        }
      } else {
        console.error(`[${this.channelType}] Invalid channel configuration`);
        process.exit(1);
      }

      // Start ping thread
      this.startPing();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      if (this.verbose) {
        console.log(`[${this.channelType}] Received:`, event.data);
      }
    };

    this.ws.onerror = (event: Event) => {
      console.error(`[${this.channelType}] WebSocket Error:`, event);
      this.cleanup();
      process.exit(1);
    };

    this.ws.onclose = (event: CloseEvent) => {
      console.log(`[${this.channelType}] WebSocket closing:`, event.code, event.reason);
      this.cleanup();
      process.exit(0);
    };

}

private startPing() {
this.pingInterval = setInterval(() => {
if (this.ws.readyState === WebSocket.OPEN) {
this.ws.send('PING');
if (this.verbose) {
console.log(`[${this.channelType}] Sent ping`);
}
}
}, 10000);
}

private cleanup() {
if (this.pingInterval) {
clearInterval(this.pingInterval);
this.pingInterval = null;
}
}

public run() {
// WebSocket connection and event handlers are already set up
if (this.verbose) {
console.log(`[${this.channelType}] WebSocket connection started`);
}
}
}

// Asset ID fetching functions
class AssetIdFetcher {
private clobApiUrl: string;
private gammaApiUrl: string;

constructor() {
this.clobApiUrl = 'https://clob.polymarket.com';
this.gammaApiUrl = 'https://gamma-api.polymarket.com';
}

// Method 1: Get asset IDs from CLOB Markets API
async getAssetIdsFromCLOB(): Promise<string[]> {
try {
const response = await fetch(`${this.clobApiUrl}/markets?next_cursor=`);
if (!response.ok) {
throw new Error(`HTTP error! status: ${response.status}`);
}

      const data: MarketsResponse = await response.json();
      const assetIds: string[] = [];

      data.data.forEach(market => {
        market.tokens.forEach(token => {
          if (token.token_id) { // Only add non-empty token IDs
            assetIds.push(token.token_id);
          }
        });
      });

      return assetIds;
    } catch (error) {
      console.error('Error fetching asset IDs from CLOB:', error);
      throw error;
    }

}

// Method 2: Get asset IDs from Gamma API
async getAssetIdsFromGamma(): Promise<string[]> {
try {
const response = await fetch(`${this.gammaApiUrl}/markets?active=true&limit=100`);
if (!response.ok) {
throw new Error(`HTTP error! status: ${response.status}`);
}

      const markets: GammaMarket[] = await response.json();
      const assetIds: string[] = [];

      markets.forEach(market => {
        if (market.clob_token_ids) {
          assetIds.push(...market.clob_token_ids);
        }
      });

      return assetIds;
    } catch (error) {
      console.error('Error fetching asset IDs from Gamma:', error);
      throw error;
    }

}

// Method 3: Get asset IDs for specific markets by condition IDs
async getAssetIdsByConditionIds(conditionIds: string[]): Promise<string[]> {
try {
const assetIds: string[] = [];

      for (const conditionId of conditionIds) {
        const response = await fetch(`${this.clobApiUrl}/markets/${conditionId}`);
        if (!response.ok) {
          console.warn(`Failed to fetch market ${conditionId}: ${response.status}`);
          continue;
        }

        const data: { market: Market } = await response.json();
        data.market.tokens.forEach(token => {
          assetIds.push(token.token_id);
        });
      }

      return assetIds;
    } catch (error) {
      console.error('Error fetching asset IDs by condition IDs:', error);
      throw error;
    }

}

// Method 4: Get asset IDs for active markets only
async getActiveMarketAssetIds(): Promise<string[]> {
try {
const response = await fetch(`${this.clobApiUrl}/markets?next_cursor=`);
if (!response.ok) {
throw new Error(`HTTP error! status: ${response.status}`);
}

      const data: MarketsResponse = await response.json();
      const assetIds: string[] = [];

      data.data
        .filter(market => market.active && !market.closed)
        .forEach(market => {
          market.tokens.forEach(token => {
            assetIds.push(token.token_id);
          });
        });

      return assetIds;
    } catch (error) {
      console.error('Error fetching active market asset IDs:', error);
      throw error;
    }

}

// Method 5: Get specific asset IDs by market slug
async getAssetIdsBySlug(slug: string): Promise<string[]> {
try {
const response = await fetch(`${this.gammaApiUrl}/markets?slug=${slug}`);
if (!response.ok) {
throw new Error(`HTTP error! status: ${response.status}`);
}

      const markets: GammaMarket[] = await response.json();
      const assetIds: string[] = [];

      markets.forEach(market => {
        if (market.clob_token_ids) {
          assetIds.push(...market.clob_token_ids);
        }
      });

      return assetIds;
    } catch (error) {
      console.error('Error fetching asset IDs by slug:', error);
      throw error;
    }

}
}

// Main implementation
async function main() {
const url = "wss://ws-subscriptions-clob.polymarket.com";

    // API credentials
    const apiKey = "6c76fca3-52ae-84de-8634-cd66dd7a16ca";
    const apiSecret = "dAT_ZElftoTcs7ONpQvZJK42BSFS7Dot5WYSKntM8Pk=";
    const apiPassphrase = "4ae7b7f36a1b68e8bfce790c06f13c8983a0923644514c003fee30927525b7e3";

    const auth: Auth = {
        apiKey,
        secret: apiSecret,
        passphrase: apiPassphrase
    };

    try {
        const fetcher = new AssetIdFetcher();

        // Get all asset IDs from CLOB
        const assetIds = await fetcher.getAssetIdsFromCLOB();
        console.log(`Found ${assetIds.length} asset IDs`);

        // Limit to first 10 asset IDs for testing
        const limitedAssetIds = assetIds.slice(0, 10);
        console.log('Using asset IDs:', limitedAssetIds);

        // Get condition IDs for user channel
        const conditionIds = await getConditionIds();
        console.log(`Found ${conditionIds.length} condition IDs`);

        // Create WebSocket connections
        const marketConnection = new WebSocketOrderBook(
            MARKET_CHANNEL,
            url,
            limitedAssetIds,
            auth,
            null,
            true
        );

        const userConnection = new WebSocketOrderBook(
            USER_CHANNEL,
            url,
            conditionIds,
            auth,
            null,
            true
        );

        // Handle process termination
        process.on('SIGINT', () => {
            console.log('\nGracefully shutting down...');
            process.exit(0);
        });

        // Start both connections
        marketConnection.run();
        userConnection.run();

    } catch (error) {
        console.error('Error in main:', error);
        process.exit(1);
    }

}

// Helper function to get condition IDs from markets (for user channel)
async function getConditionIds(): Promise<string[]> {
try {
const response = await fetch('https://clob.polymarket.com/markets?next_cursor=');
const data: MarketsResponse = await response.json();

    return data.data.map(market => market.condition_id);

} catch (error) {
console.error('Error fetching condition IDs:', error);
return [];
}
}

// Run the main function
if (require.main === module) {
main().catch(console.error);
}

export { AssetIdFetcher, WebSocketOrderBook };


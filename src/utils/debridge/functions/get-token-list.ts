import { z } from "zod";
import { TokenListResponseSchema } from "../schema";
import { env } from "../../../config/env";
import type { TokenListResponse } from "../types";

export function getDebridgeTokenList(chainId: string): Promise<TokenListResponse> {
    const url = env.DEBRIDGE_API_URL + `token-list?chainId=${chainId}`;
    console.log(url);

    return fetch(url, {
        method: "GET",
        headers: {
            accept: "application/json",
        },
    })
        .then((response) => {
            if (!response.ok) {
                return response.text().then((text) => {
                    throw new Error(
                        `DeBridge API Request Failed with Status: ${response.status}, Body: ${text}`
                    );
                });
            }
            return response.json();
        })
        .then((data) => {
            try {
                const validatedData = TokenListResponseSchema.parse(data);
                return validatedData;
            } catch (error) {
                if (error instanceof z.ZodError) {
                    console.error(
                        "Validation Error Details:",
                        JSON.stringify(error.errors, null, 2)
                    );
                    throw new Error(`Invalid DeBridge API Response Format: ${error.message}`);
                }
                throw error;
            }
        })
        .catch((error) => {
            if (error instanceof Error) {
                throw new Error(`Token List Fetch Failed: ${error.message}`);
            }
            throw new Error("An Unknown Error Occurred");
        });
}

// "11111111111111111111111111111111": {
// "symbol": "SOL",
// "name": "Solana",
// "decimals": 9,
// "address": "11111111111111111111111111111111",
// "logoURI": "https://tokens.debridge.finance/Logo/7565164/11111111111111111111111111111111/small/token-logo.svg",
// "tags": [],
// "eip2612": false

// "0x2791bca1f2de4661ed88a30c99a7a9449aa84174": {
// "symbol": "USDC",
// "name": "Bridged USDC (Polygon PoS Bridge)",
// "decimals": 6,
// "address": "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
// "logoURI": "https://tokens.debridge.finance/Logo/137/0x2791bca1f2de4661ed88a30c99a7a9449aa84174/small/token-logo.png",
// "tags": [
// {
// "name": "oneinch",
// "sourceUrl": "https://app.1inch.io/advanced/swap?network=137&src=0x2791bca1f2de4661ed88a30c99a7a9449aa84174"
// },
// {
// "name": "coingecko",
// "sourceUrl": "https://www.coingecko.com/en/coins/bridged-usdc-polygon-pos-bridge"
// }
// ],
// "eip2612": false
// },

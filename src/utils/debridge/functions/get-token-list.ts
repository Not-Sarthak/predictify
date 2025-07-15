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

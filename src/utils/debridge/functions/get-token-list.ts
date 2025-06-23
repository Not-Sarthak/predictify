import { z } from "zod";
import { TokenListResponseSchema } from "../schema";
import { DEBRIDGE_API_URL } from "../../../config/env";
import type { TokenListResponse } from "../types";

export function getDebridgeTokenList(
  chainId: string
): Promise<TokenListResponse> {
  const url = DEBRIDGE_API_URL + `token-list?chainId=${chainId}`;

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
            `API request failed with status: ${response.status}, body: ${text}`
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
            "Validation error details:",
            JSON.stringify(error.errors, null, 2)
          );
          throw new Error(`Invalid API response format: ${error.message}`);
        }
        throw error;
      }
    })
    .catch((error) => {
      if (error instanceof Error) {
        throw new Error(`Token list fetch failed: ${error.message}`);
      }
      throw new Error("An unknown error occurred");
    });
}

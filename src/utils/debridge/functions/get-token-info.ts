import { env } from "../../../config/env";
import { type deBridgeTokensInfoResponse, type GetDebridgeTokensInfoParams } from "../types";

export async function getDebridgeTokensInfo(
    parameters: GetDebridgeTokensInfoParams
): Promise<deBridgeTokensInfoResponse> {
    const url = env.DEBRIDGE_API_URL + `token-list?chainId=${parameters.chainId}`;

    const response = await fetch(url);

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
    }
    const responseData = (await response.json()) as { tokens: Record<string, any> };
    const data = responseData.tokens;

    type TokenData = {
        name: string;
        symbol: string;
        decimals: number;
    };

    if (parameters.tokenAddress) {
        const tokenInfo = data[parameters.tokenAddress];
        if (!tokenInfo) {
            throw new Error(
                `Token ${parameters.tokenAddress} not found on chain ${parameters.chainId}`
            );
        }

        return {
            tokens: {
                [parameters.tokenAddress]: {
                    name: tokenInfo.name,
                    symbol: tokenInfo.symbol,
                    address: parameters.tokenAddress,
                    decimals: tokenInfo.decimals,
                },
            },
        };
    }

    const searchTerm = parameters.search?.toLowerCase() || "";
    const tokens = Object.entries(data as Record<string, TokenData>)
        .filter(
            ([, token]: [string, TokenData]) =>
                token.symbol && (!searchTerm || token.symbol.toLowerCase().includes(searchTerm))
        )
        .reduce(
            (acc, [address, token]: [string, TokenData]) => {
                acc[address] = {
                    name: token.name,
                    symbol: token.symbol,
                    address: address,
                    decimals: token.decimals,
                };
                return acc;
            },
            {} as Record<
                string,
                {
                    name: string;
                    symbol: string;
                    address: string;
                    decimals: number;
                }
            >
        );

    return { tokens };
}

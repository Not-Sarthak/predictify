import { env } from "../../../config/env";
import type { deBridgeSupportedChainsResponse, GetDebridgeSupportedChainsParams } from "../types";

export async function getDebridgeSupportedChains(
    params?: GetDebridgeSupportedChainsParams
): Promise<deBridgeSupportedChainsResponse> {
    const url = env.DEBRIDGE_API_URL + `supported-chains-info`;

    const response = await fetch(url);

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch supported chains: ${response.status}, body: ${text}`);
    }

    // Define the expected response type
    type ApiResponse = {
        chains?: Array<{
            chainId: number | string;
            originalChainId: number | string;
            chainName: string;
        }>;
        error?: string;
    };

    const data = (await response.json()) as ApiResponse;

    // Check for API error
    if (data.error) {
        throw new Error(`API Error: ${data.error}`);
    }

    // Validate response structure
    if (!data.chains || !Array.isArray(data.chains)) {
        throw new Error(`Invalid API response format: ${JSON.stringify(data)}`);
    }

    // Convert all chains to the expected format
    let chains = data.chains.map((chain) => ({
        chainId: String(chain.chainId),
        originalChainId: String(chain.originalChainId),
        chainName: chain.chainName,
    }));

    // Apply filters if provided
    if (params) {
        // Filter by chain name if provided
        if (params.chainName) {
            const chainNameLower = params.chainName.toLowerCase();
            chains = chains.filter((chain) =>
                chain.chainName.toLowerCase().includes(chainNameLower)
            );
        }

        // Filter by chain ID if provided
        if (params.chainId) {
            chains = chains.filter(
                (chain) =>
                    chain.chainId === params.chainId || chain.originalChainId === params.chainId
            );
        }
    }

    return { chains };
}

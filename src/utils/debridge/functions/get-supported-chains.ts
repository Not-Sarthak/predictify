import { env } from "../../../config/env";
import type { deBridgeSupportedChainsResponse, GetDebridgeSupportedChainsParams } from "../types";

export async function getDebridgeSupportedChains(
    params?: GetDebridgeSupportedChainsParams
): Promise<deBridgeSupportedChainsResponse> {
    const url = env.DEBRIDGE_API_URL + `supported-chains-info`;

    const response = await fetch(url);

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to Fetch Supported Chains: ${response.status}, Body: ${text}`);
    }

    type ApiResponse = {
        chains?: Array<{
            chainId: number | string;
            originalChainId: number | string;
            chainName: string;
        }>;
        error?: string;
    };

    const data = (await response.json()) as ApiResponse;

    if (data.error) {
        throw new Error(`DeBridge API Error: ${data.error}`);
    }

    if (!data.chains || !Array.isArray(data.chains)) {
        throw new Error(`Invalid DeBridge API Response Format: ${JSON.stringify(data)}`);
    }

    let chains = data.chains.map((chain) => ({
        chainId: String(chain.chainId),
        originalChainId: String(chain.originalChainId),
        chainName: chain.chainName,
    }));

    if (params) {
        if (params.chainName) {
            const chainNameLower = params.chainName.toLowerCase();
            chains = chains.filter((chain) =>
                chain.chainName.toLowerCase().includes(chainNameLower)
            );
        }

        if (params.chainId) {
            chains = chains.filter(
                (chain) =>
                    chain.chainId === params.chainId || chain.originalChainId === params.chainId
            );
        }
    }

    return { chains };
}

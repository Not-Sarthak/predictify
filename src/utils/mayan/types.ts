import type { ChainName, Quote, QuoteParams } from "@mayanfinance/swap-sdk";

export type { ChainName, Quote, QuoteParams };

export interface MayanBridgeInput {
    amountIn64: string;
    fromToken: string;
    toToken: string;
    fromChain: ChainName;
    toChain: ChainName;
    slippageBps: "auto" | number;
    recipientAddress: string;
    senderAddress: string;
    gasDrop?: number;
    referrer?: string;
    referrerBps?: number;
}

export interface MayanBridgeResponse {
    quote: Quote;
    txData?: string;
    txHash?: string;
    error?: string;
}

export interface BridgeQuoteData {
    userId: string;
    amount: string;
    estimatedOutput: string;
    fees: string;
    quote: Quote;
    polAllocation?: number;
    usdcAllocation?: number;
    needsPOL?: boolean;
    polBridgeData?: any;
    expiresAt: number;
}

// Chain and Token Constants
export const SUPPORTED_CHAINS = {
    SOLANA: "solana" as ChainName,
    POLYGON: "polygon" as ChainName,
    ETHEREUM: "ethereum" as ChainName,
    ARBITRUM: "arbitrum" as ChainName,
    BASE: "base" as ChainName,
    BSC: "bsc" as ChainName,
    AVALANCHE: "avalanche" as ChainName,
    OPTIMISM: "optimism" as ChainName,
} as const;

// Token addresses for Solana
export const SOLANA_TOKENS = {
    SOL: "11111111111111111111111111111111", // Native SOL
    USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC on Solana
} as const;

// Token addresses for Polygon
export const POLYGON_TOKENS = {
    USDC: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174", // USDC on Polygon
    USDC_E: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174", // USDC.e on Polygon
    POL: "0x0000000000000000000000000000000000001010", // Native POL/MATIC
} as const;

export const MIN_BRIDGE_AMOUNTS = {
    SOL: 0.0127, // Minimum SOL to bridge
    RESERVE: 0.01, // Reserve amount for fees
} as const;

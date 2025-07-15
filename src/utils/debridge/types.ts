import { z } from "zod";
import { getDebridgeTokensInfoSchema, TokenListResponseSchema, TokenSchema } from "./schema";

export interface deBridgeChainInfo {
    chainId: string;
    originalChainId: string;
    chainName: string;
}

export interface deBridgeSupportedChainsResponse {
    chains: deBridgeChainInfo[];
}

export interface deBridgeTokenInfo {
    name: string;
    symbol: string;
    address: string;
    decimals: number;
    chainId?: string;
}

export interface deBridgeTokensInfoResponse {
    tokens: Record<string, deBridgeTokenInfo>;
}

export type GetDebridgeTokensInfoParams = z.infer<typeof getDebridgeTokensInfoSchema>;

export const getDebridgeSupportedChainsSchema = z.object({
    chainName: z
        .string()
        .optional()
        .describe("Filter chains by name (e.g., 'Ethereum', 'Polygon')"),
    chainId: z
        .string()
        .optional()
        .describe("Filter chains by chain ID (e.g., '1' for Ethereum, '137' for Polygon)"),
});

export type GetDebridgeSupportedChainsParams = z.infer<typeof getDebridgeSupportedChainsSchema>;

export enum ChainId {
    Ethereum = "1",
    Optimism = "10",
    BNBChain = "56",
    Polygon = "137",
    Fantom = "250",
    Base = "8453",
    ArbitrumOne = "42161",
    Avalanche = "43114",
    Linea = "59144",
    Solana = "7565164",
    Neon = "245022934",
    Gnosis = "100000001",
    Metis = "100000002",
    Bitrock = "100000004",
    CrossFi = "100000005",
    zkEVM = "100000006",
    Cronos = "100000010",
    Story = "100000013",
    Sonic = "100000014",
    Zirciut = "100000015",
    Abstract = "100000017",
    Berachain = "100000020",
    HyperEVM = "100000022",
}

export type Token = z.infer<typeof TokenSchema>;
export type TokenListResponse = z.infer<typeof TokenListResponseSchema>;

export interface deBridgeOrderInput {
    srcChainId: string;
    srcChainTokenIn: string;
    srcChainTokenInAmount: string;
    dstChainId: string;
    dstChainTokenOut: string;
    dstChainTokenOutRecipient: string;
    account: string;
    dstChainTokenOutAmount?: string;
    slippage?: number;
    additionalTakerRewardBps?: number;
    srcIntermediaryTokenAddress?: string;
    dstIntermediaryTokenAddress?: string;
    dstIntermediaryTokenSpenderAddress?: string;
    intermediaryTokenUSDPrice?: number;
    srcAllowedCancelBeneficiary?: string;
    referralCode?: number;
    affiliateFeePercent?: number;
    srcChainOrderAuthorityAddress?: string;
    srcChainRefundAddress?: string;
    dstChainOrderAuthorityAddress?: string;
    prependOperatingExpenses?: boolean;
    deBridgeApp?: string;
}

export interface deBridgeOrderResponse {
    tx?: {
        data: string;
        to?: string;
        value?: string;
    };
    estimation?: {
        srcChainTokenIn?: {
            name?: string;
            symbol?: string;
            chainId?: number;
            address?: string;
            decimals?: number;
            amount?: string;
            approximateOperatingExpense?: string;
            mutatedWithOperatingExpense?: boolean;
            approximateUsdValue?: number;
            originApproximateUsdValue?: number;
        };
        srcChainTokenOut?: {
            name?: string;
            symbol?: string;
            chainId?: number;
            address?: string;
            decimals?: number;
            amount?: string;
            maxRefundAmount?: string;
            approximateUsdValue?: number;
        };
        dstChainTokenOut?: {
            address?: string;
            chainId?: number;
            decimals?: number;
            name?: string;
            symbol?: string;
            amount?: string;
            recommendedAmount?: string;
            maxTheoreticalAmount?: string;
            approximateUsdValue?: number;
            recommendedApproximateUsdValue?: number;
            maxTheoreticalApproximateUsdValue?: number;
        };
        costsDetails?: any[];
        recommendedSlippage?: number;
    };
    prependedOperatingExpenseCost?: string;
    order?: {
        approximateFulfillmentDelay?: number;
        salt?: number;
        metadata?: string;
    };
    orderId?: string;
    fixFee?: string;
    userPoints?: number;
    integratorPoints?: number;
    estimatedTransactionFee?: {
        total?: string;
        details?: any;
    };
    usdPriceImpact?: number;
    error?: string;
}

export interface deBridgeOrderIdsResponse {
    orderIds: string[];
    errorCode?: number;
    errorMessage?: string;
}

export interface deBridgeOrderStatusResponse {
    orderId: string;
    status:
        | "None"
        | "Created"
        | "Fulfilled"
        | "SentUnlock"
        | "OrderCancelled"
        | "SentOrderCancel"
        | "ClaimedUnlock"
        | "ClaimedOrderCancel";
    srcChainTxHash?: string;
    dstChainTxHash?: string;
    orderLink?: string;
    error?: string;
}

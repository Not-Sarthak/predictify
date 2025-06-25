import { z } from "zod";

export const chainIdSchema = z.string().refine(
    (val) => {
        const num = Number.parseInt(val, 10);
        if (num > 0 && num < 100000) {
            return true;
        }
        if (num >= 100000000) {
            return true;
        }
        if (num === 7565164) {
            return true;
        }
        return false;
    },
    {
        message: "Chain ID must be either 1-99999, 7565164 (Solana), or 100000000+",
    }
);

export const getDebridgeTokensInfoSchema = z.object({
    chainId: chainIdSchema.describe(
        "Chain ID to get token information for. Examples: '1' (Ethereum), '56' (BNB Chain), '7565164' (Solana)"
    ),

    tokenAddress: z
        .string()
        .optional()
        .describe(
            "Token address to query information for. For EVM chains: use 0x-prefixed address. For Solana: use base58 token address"
        ),

    search: z
        .string()
        .optional()
        .describe("Search term to filter tokens by name or symbol (e.g., 'USDC', 'Ethereum')"),
});

const TagSchema = z.union([z.string(), z.object({}).passthrough()]);

export const TokenSchema = z
    .object({
        symbol: z.string(),
        name: z.string(),
        decimals: z.number(),
        address: z.string(),
        logoURI: z.string().optional(),
        tags: z.array(TagSchema).optional(),
        eip2612: z.boolean().optional(),
    })
    .passthrough();

export const TokenListResponseSchema = z.object({
    tokens: z.record(z.string(), TokenSchema),
});

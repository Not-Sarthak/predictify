import { z } from "zod";

export const envSchema = z.object({
    REDIS_URL: z.string().url("REDIS_URL must be a valid URL"),

    TG_BOT_TOKEN: z.string().min(1, "TG_BOT_TOKEN is required"),

    SECRET_TOKEN: z.string().min(16, "SECRET_TOKEN is required"),

    PRIVATE_KEY_ENCRYPTION_KEY: z
        .string()
        .min(32, "PRIVATE_KEY_ENCRYPTION_KEY must be a 32-char string"),

    WEBHOOK_DOMAIN: z.string().url("WEBHOOK_DOMAIN must be a valid URL"),

    USDC_CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid USDC contract address"),

    MAINNET_RPC_URL: z.string().url("MAINNET_RPC_URL must be a valid URL"),

    PRIVATE_KEY: z
        .string()
        .regex(/^0x[a-fA-F0-9]{64}$/, "PRIVATE_KEY must be a 64-char hex string starting with 0x"),

    CLOB_API_URL: z.string().url("CLOB_API_URL must be a valid URL"),

    SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),

    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

    PROJECT_ID: z.string().optional(),

    SUPABASE_ACCESS_TOKEN: z.string().optional(),

    DEBRIDGE_API_URL: z.string().url().default("https://dln.debridge.finance/v1.0"),

    DEBRIDGE_API_KEY: z.string().default("-"),

    TREASURY_ADDRESS: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, "TREASURY_ADDRESS must be a valid address"),

    NODE_ENV: z.enum(["development", "production"]).default("development"),

    SOLANA_RPC_URL: z.string().url("SOLANA_RPC_URL must be a valid URL").optional(),

    // Database connection settings for regions with connectivity issues
    DB_RETRY_COUNT: z.coerce.number().min(1).max(10).default(3),
    DB_TIMEOUT_MS: z.coerce.number().min(5000).max(60000).default(30000),
});

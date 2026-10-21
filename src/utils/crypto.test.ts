import { describe, expect, test } from "bun:test";

// config/env validates on import, so the fixture env has to exist before crypto.ts loads
Object.assign(process.env, {
    NODE_ENV: "development",
    REDIS_URL: "redis://localhost:6379",
    TG_BOT_TOKEN: "test-token",
    SECRET_TOKEN: "test-secret-token-123",
    PRIVATE_KEY_ENCRYPTION_KEY: "11".repeat(32),
    WEBHOOK_DOMAIN: "https://example.com",
    USDC_CONTRACT_ADDRESS: `0x${"22".repeat(20)}`,
    MAINNET_RPC_URL: "https://rpc.example.com",
    PRIVATE_KEY: `0x${"33".repeat(32)}`,
    CLOB_API_URL: "https://clob.example.com",
    SUPABASE_URL: "https://supabase.example.com",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    TREASURY_ADDRESS: `0x${"44".repeat(20)}`,
});

const { decryptApiCredentials, encryptApiCredentials, isPlaintextApiCredentials } = await import(
    "./crypto"
);

const creds = { key: "api-key", secret: "api-secret", passphrase: "api-passphrase" };

describe("api credentials", () => {
    test("round trip through encryption", () => {
        const stored = encryptApiCredentials(creds);

        expect(stored).not.toContain("api-secret");
        expect(isPlaintextApiCredentials(stored)).toBe(false);
        expect(decryptApiCredentials(stored)).toEqual(creds);
    });

    test("each write uses a fresh nonce", () => {
        expect(encryptApiCredentials(creds)).not.toBe(encryptApiCredentials(creds));
    });

    test("rows written before encryption still read", () => {
        const legacy = JSON.stringify(creds);

        expect(isPlaintextApiCredentials(legacy)).toBe(true);
        expect(decryptApiCredentials(legacy)).toEqual(creds);
    });

    test("a tampered ciphertext is rejected instead of decoded", () => {
        const stored = Buffer.from(encryptApiCredentials(creds), "base64");
        stored[stored.length - 1] ^= 0xff;

        expect(() => decryptApiCredentials(stored.toString("base64"))).toThrow();
    });
});

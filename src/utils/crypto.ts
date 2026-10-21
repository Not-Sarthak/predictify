import crypto from "crypto";
import { env } from "../config";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";
import type { ApiKeyCreds } from "../types/polymarket/api-key";

const PK_ENCRYPTION_KEY = Buffer.from(env.PRIVATE_KEY_ENCRYPTION_KEY, "hex"); // Private Key Encryption key
const IV_LENGTH = 12; // GCM nonce length

export const encryptPrivateKey = (privateKey: string): string => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-gcm", PK_ENCRYPTION_KEY, iv);

    const encrypted = Buffer.concat([cipher.update(privateKey, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Return as base64 encoded string
    return Buffer.concat([iv, authTag, encrypted]).toString("base64");
};

export const decryptPrivateKey = (encryptedBase64: string): string => {
    const data = Buffer.from(encryptedBase64, "base64");
    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + 16);
    const encrypted = data.subarray(IV_LENGTH + 16);

    const decipher = crypto.createDecipheriv("aes-256-gcm", PK_ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return decrypted.toString("utf-8");
};

// CLOB API credentials are encrypted the same way as the private keys. Rows written before that
// hold the plaintext JSON; base64 never starts with "{", so those still read correctly.
export const encryptApiCredentials = (creds: ApiKeyCreds): string =>
    encryptPrivateKey(JSON.stringify(creds));

export const decryptApiCredentials = (stored: string): ApiKeyCreds =>
    JSON.parse(isPlaintextApiCredentials(stored) ? stored : decryptPrivateKey(stored));

export const isPlaintextApiCredentials = (stored: string) => stored.trimStart().startsWith("{");

export const decodePrivateKey = (decryptedKey: string) => {
    const secretKey = bs58.decode(decryptedKey);
    return Keypair.fromSecretKey(secretKey);
};

export function shortHashKey(fullKey: string): string {
    return crypto.createHash("md5").update(fullKey).digest("hex").slice(0, 24);
}

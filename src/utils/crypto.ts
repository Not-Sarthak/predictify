import crypto from "crypto";
import { env } from "@/config";

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

    return decrypted.toString("utf8");
};

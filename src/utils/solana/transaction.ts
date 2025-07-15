import {
    Connection,
    Transaction,
    VersionedTransaction,
    clusterApiUrl,
    type SendOptions,
    type Commitment,
} from "@solana/web3.js";
import { decryptPrivateKey, decodePrivateKey } from "@/utils/crypto";
import { env } from "@/config";

const SOLANA_RPC_URL = env.SOLANA_RPC_URL || clusterApiUrl("mainnet-beta");
const DEFAULT_COMMITMENT: Commitment = "confirmed";

export async function executeSolanaTransaction(
    encryptedPrivateKey: string,
    transactionData: string
): Promise<string> {
    try {
        const connection = new Connection(SOLANA_RPC_URL, DEFAULT_COMMITMENT);

        const decryptedKey = decryptPrivateKey(encryptedPrivateKey);
        const keypair = decodePrivateKey(decryptedKey);

        const transactionBuffer = Buffer.from(transactionData, "base64");

        let transaction: Transaction | VersionedTransaction;
        try {
            transaction = VersionedTransaction.deserialize(transactionBuffer);
        } catch {
            transaction = Transaction.from(transactionBuffer);
        }

        if (transaction instanceof VersionedTransaction) {
            transaction.sign([keypair]);
        } else {
            transaction.partialSign(keypair);
        }

        const sendOptions: SendOptions = {
            skipPreflight: false,
            preflightCommitment: DEFAULT_COMMITMENT,
            maxRetries: 3,
        };

        let signature: string;
        if (transaction instanceof VersionedTransaction) {
            signature = await connection.sendTransaction(transaction, sendOptions);
        } else {
            signature = await connection.sendTransaction(transaction, [], sendOptions);
        }

        const latestBlockhash = await connection.getLatestBlockhash();
        const confirmation = await connection.confirmTransaction(
            {
                signature,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            },
            DEFAULT_COMMITMENT
        );

        if (confirmation.value.err) {
            throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }

        return signature;
    } catch (error) {
        console.error("Solana transaction execution error:", error);
        throw new Error(
            `Failed to execute Solana transaction: ${error instanceof Error ? error.message : "Unknown error"}`
        );
    }
}

export async function getSolanaTransactionStatus(
    signature: string
): Promise<"confirmed" | "failed" | "pending"> {
    try {
        const connection = new Connection(SOLANA_RPC_URL, DEFAULT_COMMITMENT);
        const status = await connection.getSignatureStatus(signature);

        if (!status.value) {
            return "pending";
        }

        if (status.value.err) {
            return "failed";
        }

        return status.value.confirmationStatus === "confirmed" ||
            status.value.confirmationStatus === "finalized"
            ? "confirmed"
            : "pending";
    } catch (error) {
        console.error("Error checking transaction status:", error);
        return "pending";
    }
}

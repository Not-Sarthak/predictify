import {
    Connection,
    Transaction,
    VersionedTransaction,
    TransactionMessage,
    PublicKey,
    clusterApiUrl,
    type SendOptions,
    type Commitment,
} from "@solana/web3.js";
import { decodePrivateKey } from "@/utils/crypto";
import { env } from "@/config";

const SOLANA_RPC_URL = env.SOLANA_RPC_URL || clusterApiUrl("mainnet-beta");
const DEFAULT_COMMITMENT: Commitment = "confirmed";

export async function executeSolanaTransaction(
    privateKey: string,
    transactionData: string
): Promise<string> {
    try {
        const connection = new Connection(SOLANA_RPC_URL, DEFAULT_COMMITMENT);
        const keypair = decodePrivateKey(privateKey);

        let transactionBuffer: Buffer;
        if (transactionData.startsWith("0x")) {
            transactionBuffer = Buffer.from(transactionData.slice(2), "hex");
        } else {
            transactionBuffer = Buffer.from(transactionData, "base64");
        }

        let transaction: Transaction | VersionedTransaction;
        try {
            transaction = VersionedTransaction.deserialize(transactionBuffer);
        } catch {
            transaction = Transaction.from(transactionBuffer);
        }

        const latestBlockhash = await connection.getLatestBlockhash();

        if (transaction instanceof VersionedTransaction) {
            const addressLookupTableAccounts = [];
            for (const lookup of transaction.message.addressTableLookups) {
                try {
                    const lookupTableAccount = await connection.getAddressLookupTable(
                        lookup.accountKey
                    );
                    if (lookupTableAccount.value) {
                        addressLookupTableAccounts.push(lookupTableAccount.value);
                    }
                } catch (e) {
                    // Continue if lookup table fetch fails
                }
            }

            const message = TransactionMessage.decompile(transaction.message, {
                addressLookupTableAccounts,
            });

            message.recentBlockhash = latestBlockhash.blockhash;
            const newMessage = message.compileToV0Message(addressLookupTableAccounts);
            transaction = new VersionedTransaction(newMessage);
            transaction.sign([keypair]);
        } else {
            transaction.recentBlockhash = latestBlockhash.blockhash;
            transaction.feePayer = keypair.publicKey;
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

        return signature;
    } catch (error) {
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

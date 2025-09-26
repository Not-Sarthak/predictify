import { swapFromSolana, type SolanaTransactionSigner } from "@mayanfinance/swap-sdk";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import type { Quote } from "../types";
import { decodePrivateKey } from "../../crypto";
import { Transaction } from "@solana/web3.js";

export async function createMayanBridgeOrder(
    quote: Quote,
    originWalletAddress: string,
    destinationWalletAddress: string,
    privateKey: string,
    solanaRpcUrl: string = "https://api.mainnet-beta.solana.com"
): Promise<{ txHash: string }> {
    try {
        const connection = new Connection(solanaRpcUrl, "confirmed");

        // Create keypair from private key
        const keypair = decodePrivateKey(privateKey);

        const signer: SolanaTransactionSigner = (async (
            trx: Transaction | VersionedTransaction
        ): Promise<any> => {
            if (trx instanceof Transaction) {
                trx.sign(keypair);
                return trx;
            } else {
                trx.sign([keypair]);
                return trx;
            }
        }) as SolanaTransactionSigner;

        // Execute the swap
        const result = await swapFromSolana(
            quote,
            originWalletAddress,
            destinationWalletAddress,
            undefined, // referrerAddresses - optional
            signer,
            connection
        );

        if (!result || !result.signature) {
            throw new Error("Failed to execute Mayan bridge transaction");
        }

        return { txHash: result.signature };
    } catch (error) {
        console.error("Error creating Mayan bridge order:", error);
        throw new Error(
            `Failed to create bridge order: ${error instanceof Error ? error.message : "Unknown error"}`
        );
    }
}

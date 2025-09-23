import { swapFromSolana } from "@mayanfinance/swap-sdk";
import { Connection, Keypair } from "@solana/web3.js";
import type { Quote } from "../types";

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
        const keypair = Keypair.fromSecretKey(
            typeof privateKey === "string" ? Buffer.from(privateKey, "base64") : privateKey
        );

        // Sign transaction function
        const signSolanaTransaction = async (tx: any) => {
            tx.sign(keypair);
            return tx;
        };

        // Execute the swap
        const result = await swapFromSolana(
            quote,
            originWalletAddress,
            destinationWalletAddress,
            undefined, // referrerAddresses - optional
            signSolanaTransaction,
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

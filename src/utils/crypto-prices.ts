/**
 * Utility functions for getting cryptocurrency prices
 */

interface CoinGeckoPriceResponse {
    solana?: {
        usd?: number;
    };
    "polygon-ecosystem-token"?: {
        usd?: number;
    };
}

/**
 * Get current SOL price in USD from CoinGecko
 * @returns SOL price in USD, fallback to 150 if API fails
 */
export const getSOLPriceUSD = async (): Promise<number> => {
    try {
        const response = await fetch(
            "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
            {
                headers: {
                    Accept: "application/json",
                },
            }
        );

        if (!response.ok) {
            throw new Error(`CoinGecko API error: ${response.status}`);
        }

        const data: CoinGeckoPriceResponse = await response.json();
        const solPrice = data.solana?.usd;

        if (!solPrice || solPrice <= 0) {
            throw new Error("Invalid SOL price received");
        }

        return solPrice;
    } catch (error) {
        console.error("Error fetching SOL price, using fallback:", error);
        return 150; // Fallback price
    }
};

/**
 * Get current POL token price in USD from CoinGecko
 * @returns POL price in USD, fallback to 0.5 if API fails
 */
export const getPOLPriceUSD = async (): Promise<number> => {
    try {
        const response = await fetch(
            "https://api.coingecko.com/api/v3/simple/price?ids=polygon-ecosystem-token&vs_currencies=usd",
            {
                headers: {
                    Accept: "application/json",
                },
            }
        );

        if (!response.ok) {
            throw new Error(`CoinGecko API error: ${response.status}`);
        }

        const data: CoinGeckoPriceResponse = await response.json();
        const polPrice = data["polygon-ecosystem-token"]?.usd;

        if (!polPrice || polPrice <= 0) {
            throw new Error("Invalid POL price received");
        }

        return polPrice;
    } catch (error) {
        console.error("Error fetching POL price, using fallback:", error);
        return 0.5; // Fallback price
    }
};

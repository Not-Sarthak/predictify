import { env } from "../../config/env";

export async function fetchClobPriceHistory(tokenId: string) {
    const currentTime = Math.floor(Date.now() / 1000);

    const intervals = [5, 10, 15, 20, 25];

    const priceHistoryPromises = intervals.map(async (secondsAgo) => {
        const startTime = currentTime - secondsAgo;
        const url = `${env.CLOB_API_URL}/prices-history?market=${tokenId}&startTs=${startTime}&endTs=${currentTime}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            return {
                interval: `${secondsAgo}s`,
                data: data,
            };
        } catch (error) {
            return {
                interval: `${secondsAgo}s`,
                data: null,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });

    try {
        const results = await Promise.all(priceHistoryPromises);
        return results;
    } catch (error) {
        return null;
    }
}

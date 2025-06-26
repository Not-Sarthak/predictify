export async function getMarketDetails(marketId: string) {
    try {
        const response = await fetch(`https://gamma-api.polymarket.com/markets?id=${marketId}`);

        const marketDataArray = await response.json();
        const { question, description, volumeNum, active, orderMinSize } = marketDataArray[0];

        return { question, description, volumeNum, active, orderMinSize };
    } catch (error) {
        console.error("Failed to fetch Market Details: ", error);
        return null;
    }
}

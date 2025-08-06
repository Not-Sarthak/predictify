export async function getTokenId(decision: string, marketId: string) {
    let url;

    if (marketId.startsWith("0x")) {
        url = `https://gamma-api.polymarket.com/markets?condition_ids=${marketId}`;
    } else {
        url = `https://gamma-api.polymarket.com/markets?id=${marketId}`;
    }

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!data || !Array.isArray(data) || data.length === 0) {
            console.error(`No market data found for Market ID ${marketId}`);
            return null;
        }

        const marketData = data[0];

        if (!marketData.clobTokenIds) {
            console.error(`clobTokenIds not found for Market ID ${marketId}`);
            return null;
        }

        const tokenIds = JSON.parse(marketData.clobTokenIds);

        if (!Array.isArray(tokenIds) || tokenIds.length < 2) {
            console.error(`Invalid tokenIds format for Market ID ${marketId}`);
            return null;
        }

        const tokenId = decision === "yes" ? tokenIds[0] : tokenIds[1];
        return tokenId;
    } catch (error) {
        console.error(`Error fetching Token IDs for Market with ID ${marketId}: `, error);
        return null;
    }
}

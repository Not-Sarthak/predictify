export async function getMarketQuestion(marketId: string): Promise<string | null> {
    let url;

    if (marketId.startsWith("0x")) {
        url = `https://gamma-api.polymarket.com/markets?condition_ids=${marketId}`;
    } else {
        url = `https://gamma-api.polymarket.com/markets?id=${marketId}`;
    }

    try {
        const res = await fetch(url);
        const market = await res.json();

        if (!market) return null;

        return market[0].question;
    } catch (error) {
        console.error("❌ Error fetching Market Question: ", error);
        return null;
    }
}

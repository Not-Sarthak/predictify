export async function getMarketQuestion(marketId: string): Promise<string | null> {
    try {
        const res = await fetch(`https://gamma-api.polymarket.com/markets?id=${marketId}`);
        const market = await res.json();

        console.log(market);

        if (!market) return null;

        return market[0].question;
    } catch (error) {
        console.error("❌ Error fetching Market Question: ", error);
        return null;
    }
}

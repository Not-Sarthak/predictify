export async function getTokenId(decision: string, marketId: string) {
  try {
    const response = await fetch(
      `https://gamma-api.polymarket.com/markets?id=${marketId}`
    );
    const data = await response.json();
    const marketData = data[0];
    const tokenIds = JSON.parse(marketData.clobTokenIds);

    const tokenId = decision === "yes" ? tokenIds[0] : tokenIds[1];
    return tokenId;
  } catch (error) {
    console.error(
      `Error fetching Token IDs for Market with ID ${marketId}: `,
      error
    );
    return null;
  }
}

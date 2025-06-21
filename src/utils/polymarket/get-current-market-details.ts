export async function getTokenIdsForMarket(conditionId: string) {
  try {
    const response = await fetch(
      `https://gamma-api.polymarket.com/markets?condition_ids=${conditionId}`
    );
    const markets = await response.json();

    if (markets && markets.length > 0) {
      const market = markets[0];
      const tokenIds = JSON.parse(market.clobTokenIds);
      return {
        yesTokenId: tokenIds[0],
        noTokenId: tokenIds[1],
        marketInfo: market,
      };
    }
  } catch (error) {
    console.error("Error Fetching Token IDs for Market:", error);
    throw error;
  }
}

// getTokenIdsForMarket("0x896d1877ca71ffa3d43c046fdacd4470f1a8c0cf91e14ed66d9d0e0b3099dfe5").then((result) => {
//   console.log(result?.yesTokenId);
//   console.log(result?.noTokenId);
// });


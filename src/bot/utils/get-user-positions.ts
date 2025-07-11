export async function getUserPositionsFromPolymarket(wallet_address: string) {
    try {
        const res = await fetch(
            `https://data-api.polymarket.com/positions?sizeThreshold=1&sortDirection=DESC&user=${wallet_address}`
        );

        const positionsArray = await res.json();

        return positionsArray;
    } catch (error) {
        console.error("Error fetching User positions: ", error);
        return null;
    }
}

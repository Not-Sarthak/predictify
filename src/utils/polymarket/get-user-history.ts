import axios from "axios";

export async function getUserHistory(userAddress: string) {
    const response = await axios.get("https://data-api.polymarket.com/trades", {
        params: {
            limit: 100,
            takerOnly: true,
            user: userAddress.toLowerCase(),
        },
    });

    return response.data;
}

// Example usage:
// const trades = await getUserHistory('userAddress');

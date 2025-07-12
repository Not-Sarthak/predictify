import axios from "axios";

interface UserTradeHistory {
    proxyWallet: string;
    side: string;
    asset: string;
    conditionId: string;
    size: number;
    price: number;
    timestamp: number;
    title: string;
    slug: string;
    icon: string;
    eventSlug: string;
    outcome: string;
    outcomeIndex: number;
    name: string;
    pseudonym: string;
    bio: string;
    profileImage: string;
    profileImageOptimized: string;
    transactionHash: string;
}

export async function getUserHistory(userAddress: string): Promise<UserTradeHistory[]> {
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

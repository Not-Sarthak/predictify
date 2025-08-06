import axios from "axios";
import type {
    UserPositionRequest,
    UserPositionResponse,
} from "../../types/polymarket/user-position";

export const getUserPosition = async (request: UserPositionRequest) => {
    const response = await axios.get<UserPositionResponse[]>(
        `https://data-api.polymarket.com/positions?user=${request.user}`
    );

    return response.data;
};

export const getUserPositionByMarket = async (userId: string, conditionId: string) => {
    // First, try to get all user positions and filter by conditionId
    const allPositionsResponse = await axios.get<UserPositionResponse[]>(
        `https://data-api.polymarket.com/positions?user=${userId}`
    );

    // Filter positions by conditionId
    const matchingPosition = allPositionsResponse.data.find(
        (pos) => pos.conditionId === conditionId
    );

    if (matchingPosition) {
        return matchingPosition;
    }

    // If not found, try the original market query as fallback
    const response = await axios.get<UserPositionResponse[]>(
        `https://data-api.polymarket.com/positions?user=${userId}&market=${conditionId}`
    );

    if (response.data.length == 0) {
        return null;
    }

    return response.data[0];
};

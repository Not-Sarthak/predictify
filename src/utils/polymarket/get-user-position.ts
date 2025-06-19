import axios from 'axios';
import type { UserPositionRequest, UserPositionResponse } from '../../types/user-position';

export const getUserPosition = async (request: UserPositionRequest) => {
    const response = await axios.get<UserPositionResponse>(`https://data-api.polymarket.com/positions?user=${request.user}`);
    console.log(response.data);
    return response.data;
}

// getUserPosition({
//     user: "0xecb14ac6e9ca447ce2f2912e6217b43d7b655da3"
// });
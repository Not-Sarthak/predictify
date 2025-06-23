import axios from "axios";
import type {
  UserPositionRequest,
  UserPositionResponse,
} from "../../types/user-position";

export const getUserPosition = async (request: UserPositionRequest) => {
  const response = await axios.get<UserPositionResponse[]>(
    `https://data-api.polymarket.com/positions?user=${request.user}`
  );

  return response.data;
};

// getUserPosition({
//   user: "0xef7E2F8F5c7c8ae0Bfd1A7D55628616175BC25FB",
// });

export const getAllUserHistory = async (request: UserPositionRequest) => {
  const response = await axios.get<UserPositionResponse>(
    `https://data-api.polymarket.com/activity?user=${request.user}`
  );
  console.log(response.data);
  return response.data;
};

// getAllUserHistory({
//   user: "0xef7E2F8F5c7c8ae0Bfd1A7D55628616175BC25FB",
// });

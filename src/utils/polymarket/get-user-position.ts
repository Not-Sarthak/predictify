import axios from "axios";
import type {
    UserPositionRequest,
    UserPositionResponse,
} from "../../shared/types/polymarket/user-position";

import { type ApiKeyCreds, ClobClient } from "@polymarket/clob-client";
import { Wallet } from "ethers";

export const getUserPosition = async (request: UserPositionRequest) => {
    const response = await axios.get<UserPositionResponse[]>(
        `https://data-api.polymarket.com/positions?user=${request.user}`
    );

    return response.data;
};

export const getUserPositionByMarket = async (userId: string, conditionId: string) => {
    const response = await axios.get<UserPositionResponse[]>(
        `https://data-api.polymarket.com/positions?user=${userId}&market=${conditionId}`
    );

    if (response.data.length == 0) {
        return null;
    }

    return response.data[0];
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

interface GetOpenOrdersProps {
    mainnet: boolean;
    apiKey: string;
    secret: string;
    passphrase: string;
}

export async function getOpenOrders({ mainnet, apiKey, secret, passphrase }: GetOpenOrdersProps) {
    const chainId = mainnet ? 137 : 80002;

    const creds: ApiKeyCreds = {
        key: apiKey,
        secret,
        passphrase,
    };

    const wallet = new Wallet("0x68afd4e25df9f64382038e4aae0ec7ba4a9833c1079dc1521538656a9d2ef1c3");

    const clobClient = new ClobClient("http://clob.polymarket.com/", chainId, wallet as any, creds);

    const resp = await clobClient.getOpenOrders();
    console.log(resp);
    console.log(`Done!`);
}

// getOpenOrders({
//     mainnet: true,
//     apiKey: "f3e137a7-3a85-d6fa-292a-3db867dcd441",
//     secret: "8qfO6fgz14qvKZPKO-74PRuepSbaexlJLVtscoPnsLY=",
//     passphrase: "d1294f22392578c29e9caaeac0ae40bcc2c37a75578bdf78dafd38178bc25a9e",
// });

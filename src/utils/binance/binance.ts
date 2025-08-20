import axios from "axios";

export const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT"];

export async function getTokenPriceAt(symbol: string, timestamp: number): Promise<number> {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&startTime=${timestamp}&endTime=${timestamp + 1}&limit=1`;

    const res = await axios.get(url);
    const data = res.data as any[];
    if (data.length === 0) throw new Error("No Price Data Found");

    return parseFloat(data[0][4]);
}

// (async () => {
//   const timestamp = Date.now() - 60_000;
//   const prices = await Promise.all(
//     symbols.map(async (s) => ({
//       symbol: s,
//       price: await getTokenPriceAt(s, timestamp),
//     }))
//   );

//   console.log(prices);
// })();

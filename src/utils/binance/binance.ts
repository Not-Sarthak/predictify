import axios from "axios";
import { DateTime } from "luxon";
import { redisClient } from "../../lib/redis";

export type Symbols = "BTCUSDT" | "ETHUSDT" | "SOLUSDT" | "XRPUSDT";

export async function getTokenPriceAtMarketStart(
    symbol: Symbols,
    isoTime: string
): Promise<number> {
    // eventStartTime is ISO with Z (UTC). Respect that zone.
    const startUtc = DateTime.fromISO(isoTime, { setZone: true }).toUTC().startOf("hour");

    const startTime = startUtc.toMillis();
    const endTime = startTime + 60 * 60 * 1000; // 1 hour later

    const cacheKey = `price:${symbol}:${startUtc.toISO()}`;

    // 1️⃣ Try Redis cache first
    const cached = await redisClient.get(cacheKey);
    if (cached) {
        return parseFloat(cached);
    }

    // 2️⃣ Fetch from Binance
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&startTime=${startTime}&endTime=${endTime}&limit=1`;

    const res = await axios.get(url);
    const data = res.data as any[];

    if (!Array.isArray(data) || data.length === 0) {
        throw new Error(`No hourly candle found for ${symbol} at ${isoTime}`);
    }

    const open = parseFloat(data[0][1]); // OPEN of the 1H candle

    // 3️⃣ Compute TTL = time remaining in this hour
    const now = DateTime.utc();
    const nextHour = startUtc.plus({ hours: 1 });
    const ttlSeconds = Math.max(Math.floor(nextHour.diff(now, "seconds").seconds), 60); // at least 1min

    // 4️⃣ Cache in Redis
    await redisClient.setEx(cacheKey, ttlSeconds, open.toString());

    return open;
}

export async function getCurrentTokenPrice(symbol: Symbols): Promise<number> {
    const cacheKey = `current_price:${symbol}`;

    // 1️⃣ Try Redis cache first
    const cached = await redisClient.get(cacheKey);
    if (cached) {
        return parseFloat(cached);
    }

    // 2️⃣ Fetch from Binance Ticker Price API
    const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
    const res = await axios.get(url);

    if (!res.data || !res.data.price) {
        throw new Error(`No ticker price found for ${symbol}`);
    }

    const price = parseFloat(res.data.price);

    // 3️⃣ Cache in Redis for 60 seconds (1 min)
    await redisClient.setEx(cacheKey, 60, price.toString());

    return price;
}

export function encodeMarketId(marketId: string) {
    const hex = marketId.startsWith("0x") ? marketId.slice(2) : marketId;
    const buf = Buffer.from(hex, "hex");
    return buf.toString("base64");
}

export function decodeMarketId(encoded: string): string {
    const buf = Buffer.from(encoded, "base64");
    return "0x" + buf.toString("hex");
}

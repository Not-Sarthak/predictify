/**
 * Utility function to serialize objects containing BigInt values to JSON
 * @param obj The object to serialize
 * @param space Optional formatting space parameter for JSON.stringify
 * @returns JSON string with BigInt values converted to strings
 */
export function serializeBigInt(obj: any, space?: string | number): string {
    return JSON.stringify(
        obj,
        (key, value) => (typeof value === "bigint" ? value.toString() : value),
        space
    );
}

/**
 * Custom replacer function for JSON.stringify to handle BigInt values
 */
export const bigIntReplacer = (key: string, value: any) =>
    typeof value === "bigint" ? value.toString() : value;

/**
 * Utility function to safely log objects that may contain BigInt values
 * @param message Log message
 * @param obj Object to log
 */
export function logWithBigInt(message: string, obj: any): void {
    console.log(message, serializeBigInt(obj, 2));
}

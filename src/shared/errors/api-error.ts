export class APIError extends Error {
    public statusCode: number;
    public details?: unknown;

    constructor(message: string, statusCode = 500, details?: unknown) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;

        Object.setPrototypeOf(this, APIError.prototype);
    }
}

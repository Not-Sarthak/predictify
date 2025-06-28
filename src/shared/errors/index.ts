import { APIError } from "./api-error";

export class BadRequestError extends APIError {
    constructor(message = "Bad Request", details?: unknown) {
        super(message, 400, details);
    }
}

export class NotFoundError extends APIError {
    constructor(message = "Not Found", details?: unknown) {
        super(message, 404, details);
    }
}

export class InternalServerError extends APIError {
    constructor(message = "Internal Server Error", details?: unknown) {
        super(message, 500, details);
    }
}

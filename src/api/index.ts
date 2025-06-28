import Fastify from "fastify";
import helmet from "@fastify/helmet";
import { userRoutes } from "./routes/user-routes";
import { APIError } from "../shared/errors/api-error";

const server = Fastify({
    logger: {
        level: "info",
        transport:
            process.env.NODE_ENV !== "production"
                ? {
                      target: "pino-pretty",
                      options: {
                          colorize: true,
                          translateTime: "SYS:standard",
                          ignore: "pid,hostname",
                      },
                  }
                : undefined,
    },
});

// HTTP headers security middleware
await server.register(helmet);

// Global API Server Error handler
server.setErrorHandler((err, request, reply) => {
    if (err instanceof APIError) {
        request.log.warn({
            type: "APIError",
            url: request.url,
            method: request.method,
            params: request.params,
            query: request.query,
            body: request.body,
            message: err.message,
            details: err.details,
        });

        return reply.status(err.statusCode).send({
            error: err.message,
            details: err.details ?? null,
        });
    }

    request.log.error({
        type: "UnhandledError",
        url: request.url,
        method: request.method,
        params: request.params,
        query: request.query,
        body: request.body,
        error: err,
    });
    return reply.status(500).send({ error: "Internal Server Error" });
});

// Health Check Endpoint
server.get("/health", async () => ({
    status: "ok",
    timestamp: Date.now(),
}));

// User Routes
server.register(userRoutes, { prefix: "/api/users" });

export { server as apiServer };

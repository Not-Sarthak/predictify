import type { FastifyInstance } from "fastify";

import { createNewUser, getUserDetails } from "../controllers/user-controller";
import { getUserTrades } from "../controllers/trade-controller";

export async function userRoutes(server: FastifyInstance) {
    server.get("/:id", getUserDetails);

    server.get("/:id/trades", getUserTrades);

    server.post("/", createNewUser);
}

import Fastify from "fastify";
import { userRoutes } from "../routes/userRoutes";
import { tradeRoutes } from "../routes/tradeRoutes";

const server = Fastify();

server.register(userRoutes, { prefix: "/api/users" });
server.register(tradeRoutes, { prefix: "/api/trades" });

export { server };

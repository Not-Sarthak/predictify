import type { FastifyInstance } from "fastify";
import { getUserDetails, generateReferralCodes } from "../controllers/user-controller";

export async function userRoutes(fastify: FastifyInstance) {
    fastify.get("/user/:id", getUserDetails);
    fastify.get("/referral/generate", generateReferralCodes);
}

import type { FastifyInstance } from "fastify";
import { supabase } from "../config/supabase";

export async function tradeRoutes(server: FastifyInstance) {
    server.get("/:id", async (request, reply) => {
        const { id } = request.params as { id: string };

        if (!id) {
            return reply.code(400).send({ error: "Missing User ID" });
        }

        const { data, error } = await supabase
            .from("Positions")
            .select(
                "id, wallet_address, market, market_slug, question, description, token_id, buys, sells, amount, pnl_individual, pnl_all, fees"
            )
            .eq("id", id)
            .filter("is_open", "eq", true);

        if (!data) {
            return reply.status(404).send({ error: "No Active Positions" });
        }

        if (error) {
            console.error("Supabase error:", error);
            return reply.status(500).send({ error: "Failed to fetch Active Positions" });
        }

        return reply.send({ positions: data });
    });
}

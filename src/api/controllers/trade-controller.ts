import type { FastifyReply } from "fastify";
import type { RequestWithIdParam } from "../../shared/types/api";

import { supabase } from "../../config/supabase";
import { BadRequestError, InternalServerError, NotFoundError } from "../../shared/errors";

export const getUserTrades = async (request: RequestWithIdParam, reply: FastifyReply) => {
    const { id } = request.params;

    if (!id) throw new BadRequestError("User ID is required");

    const { data, error } = await supabase
        .from("Positions")
        .select(
            "id, wallet_address, market, market_slug, question, description, token_id, buys, sells, amount, pnl_individual, pnl_all, fees"
        )
        .eq("id", Number(id))
        .filter("is_open", "eq", true);

    if (error) throw new InternalServerError("Failed to fetch positions", error);

    if (!data || data.length === 0) {
        throw new NotFoundError("No Active Positions");
    }

    return reply.send({ positions: data });
};

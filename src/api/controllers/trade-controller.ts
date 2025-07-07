import type { FastifyReply } from "fastify";
import type { RequestWithIdParam } from "../../shared/types/api";

import { db } from "../../lib/supabase";
import { BadRequestError, InternalServerError, NotFoundError } from "../../shared/errors";
import { cache } from "@/shared/utils";
import type { TableRow } from "@/shared/types/supabase";

export const getUserTrades = async (request: RequestWithIdParam, reply: FastifyReply) => {
    const { id } = request.params;

    if (!id) throw new BadRequestError("User ID is required");

    const cachedTrades = await cache.get<Array<TableRow<"Positions">>>(id, "json");

    if (!cachedTrades) {
        const { data, error } = await db("Positions")
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
    }

    return cachedTrades;
};

import type { FastifyReply } from "fastify";
import type { RequestWithIdParam } from "../../shared/types/api";

import { z } from "zod";
import { supabase } from "../../lib/supabase";
import { generateAPIKeyAndWallet } from "../../utils/polymarket/generate-user";
import { CHAIN_ID, HOST } from "../../shared/constants";
import { BadRequestError, InternalServerError, NotFoundError } from "../../shared/errors";

export const getUserDetails = async (request: RequestWithIdParam, reply: FastifyReply) => {
    const { id } = request.params;

    if (!id) throw new BadRequestError("User ID is required");

    const { data, error } = await supabase.from("Users").select("*").eq("id", Number(id)).single();

    if (!data) {
        throw new NotFoundError("User not found");
    }

    if (error) {
        throw new InternalServerError("Failed to fetch user", error);
    }

    return reply.send({ user: data });
};

export const createNewUser = async (request: RequestWithIdParam, reply: FastifyReply) => {
    const {
        data,
        success,
        error: validationError,
    } = z
        .object({
            telegramId: z.number(),
            telegramUsername: z.string(),
        })
        .safeParse(request.body);

    if (!success || validationError) {
        throw new BadRequestError("Invalid Request Body");
    }

    const { address, privateKey, apiCreds, solanaAddress, solanaPrivateKey } =
        await generateAPIKeyAndWallet({
            host: HOST,
            chainId: CHAIN_ID,
        });

    const { error } = await supabase.from("Users").insert([
        {
            id: data.telegramId,
            telegram_username: data.telegramUsername,
            wallet_address: address,
            private_key: privateKey,
            api_credentials: JSON.stringify(apiCreds),
            solana_address: solanaAddress,
            solana_private_key: solanaPrivateKey,
        },
    ]);

    if (error) throw new InternalServerError("Error creating new user", error);

    return reply.code(201).send();
};

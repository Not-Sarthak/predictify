import type { FastifyReply } from "fastify";
import type { RequestWithIdParam } from "@/types/api";

import { z } from "zod";
import { db } from "../../lib/supabase";
import { generateAPIKeyAndWallet } from "../../utils/polymarket/generate-user";
import { CHAIN_ID, HOST } from "../../shared/constants";
import { BadRequestError, InternalServerError, NotFoundError } from "../../shared/errors";
import { encryptPrivateKey } from "@/utils/crypto";
import { generateRandomString } from "@/utils/encoding";
import type { FastifyRequest } from "fastify";

export const getUserDetails = async (request: RequestWithIdParam, reply: FastifyReply) => {
    const { id } = request.params;

    if (!id) throw new BadRequestError("User ID is required");

    const { data, error } = await db("Users").select("*").eq("id", Number(id)).single();

    if (error) {
        throw new InternalServerError("Failed to fetch user", error);
    }

    if (!data) {
        throw new NotFoundError("User not found");
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

    const { error } = await db("Users").insert([
        {
            id: data.telegramId,
            telegram_username: data.telegramUsername,
            wallet_address: address,
            private_key: encryptPrivateKey(privateKey),
            api_credentials: JSON.stringify(apiCreds),
            solana_address: solanaAddress,
            solana_private_key: encryptPrivateKey(solanaPrivateKey),
        },
    ]);

    if (error) throw new InternalServerError("Error creating new user", error);

    return reply.code(201).send();
};

export async function generateReferralCodes(
    request: FastifyRequest<{
        Querystring: {
            count?: string;
        };
    }>,
    reply: FastifyReply
) {
    const secretKey = request.headers["x-secret-key"];
    if (!secretKey || secretKey !== process.env.ADMIN_SECRET_KEY) {
        return reply.code(401).send({ error: "Unauthorized" });
    }

    const count = parseInt(request.query.count || "5");
    if (count < 1 || count > 10) {
        return reply.code(400).send({ error: "Count Must Be Between 1 and 10" });
    }

    try {
        const codes = [];
        for (let i = 0; i < count; i++) {
            const code = generateRandomString(6);
            codes.push(code);

            await db("Users").insert({
                referral_code: code,
                id: -1 * (Date.now() + i),
                telegram_username: "ADMIN",
                wallet_address: "",
                private_key: "",
                api_credentials: "",
                solana_address: "",
                solana_private_key: "",
            });
        }

        return reply.send({ success: true, codes });
    } catch (error) {
        console.error("Error generating referral codes:", error);
        return reply.code(500).send({ error: "Internal server error" });
    }
}

export async function checkReferralCode(
    request: FastifyRequest<{
        Querystring: {
            code: string;
        };
    }>,
    reply: FastifyReply
) {
    const { code } = request.query;

    if (!code) {
        return reply.code(400).send({ valid: false });
    }

    try {
        if (code.toUpperCase() === "PRED") {
            return reply.send({ valid: true });
        }

        const { data } = await db("Users").select("id").eq("referral_code", code).single();

        return reply.send({ valid: !!data });
    } catch (error) {
        return reply.send({ valid: false });
    }
}

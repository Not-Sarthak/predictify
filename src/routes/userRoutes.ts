import type { FastifyInstance } from "fastify";
import { supabase } from "../config/supabase";
import { validateIncomingRequestBody } from "../helpers/validation";
import { generateAPIKeyAndWallet } from "../utils/polymarket/generate-user";
import { CHAIN_ID, HOST } from "../constants/polymarket";

export async function userRoutes(server: FastifyInstance) {
    server.get("/:id", async (request, reply) => {
        const { id } = request.params as { id: string };

        if (!id) {
            return reply.code(400).send({ error: "Missing User ID" });
        }

        const { data, error } = await supabase.from("Users").select("*").eq("id", id).single();

        if (!data) {
            return reply.status(404).send({ error: "User not found" });
        }

        if (error) {
            console.error("Supabase error:", error);
            return reply.status(500).send({ error: "Failed to fetch user" });
        }

        return reply.send({ user: data });
    });

    server.post("/", async (request, reply) => {
        const validatedBody = validateIncomingRequestBody(request.body);

        if (!validatedBody) {
            return reply.code(400).send({ error: "Invalid Request Body" });
        }

        const { address, privateKey, apiCreds } = await generateAPIKeyAndWallet({
            host: HOST,
            chainId: CHAIN_ID,
        });

        const { error } = await supabase.from("Users").insert([
            {
                id: validatedBody.telegramId,
                telegram_username: validatedBody.telegramUsername,
                wallet_address: address,
                private_key: privateKey,
                api_credentials: JSON.stringify(apiCreds),
            },
        ]);

        if (error) {
            console.error("Supabase Error: ", error);
            return reply.code(500).send({ error: "Error creating new user" });
        }

        return reply.code(201).send();
    });
}

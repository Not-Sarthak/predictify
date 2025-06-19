import z from "zod";

export const IncomingCreateUserRequestBodySchema = z.object({
  telegramId: z.number(),
  telegramUsername: z.string(),
});

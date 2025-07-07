import type { FastifyRequest } from "fastify";

export type IdParam = { id: string };

/**
 * @type Fastify Request with Id Parameter
 */
export type RequestWithIdParam = FastifyRequest<{ Params: IdParam }>;

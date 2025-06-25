import { IncomingCreateUserRequestBodySchema } from "../utils/schema";

export const validateIncomingRequestBody = (requestBody: any) => {
    const result = IncomingCreateUserRequestBodySchema.safeParse(requestBody);

    if (!result.success || result.error) {
        console.error(result.error);
        return null;
    }

    return result.data;
};

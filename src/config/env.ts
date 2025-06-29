import { configDotenv } from "dotenv";
import { envSchema } from "./env.schema";

// Load .env
configDotenv();

// Parse and validate environment
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
    console.error("❌ Invalid environment variables:", parsedEnv.error.format());
    process.exit(1);
}

export const env = parsedEnv.data;

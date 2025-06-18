import { configDotenv } from "dotenv";
import env from "env-var";

configDotenv();

export const REDIS_URL = env.get("REDIS_URL").required().asString();

export const TG_BOT_TOKEN = env.get("TG_BOT_TOKEN").required().asString();

export const SECRET_TOKEN = env.get("SECRET_TOKEN").required().asString();

export const WEBHOOK_DOMAIN = env.get("WEBHOOK_DOMAIN").required().asString();
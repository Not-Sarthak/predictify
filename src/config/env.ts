import { configDotenv } from "dotenv";
import env from "env-var";

configDotenv();

export const REDIS_URL = env.get("REDIS_URL").required().asString();

export const TG_BOT_TOKEN = env.get("TG_BOT_TOKEN").required().asString();

export const SECRET_TOKEN = env.get("SECRET_TOKEN").required().asString();

export const WEBHOOK_DOMAIN = env.get("WEBHOOK_DOMAIN").required().asString();

export const USDC_CONTRACT_ADDRESS = env.get("USDC_CONTRACT_ADDRESS").required().asString();

export const MAINNET_RPC_URL = env.get("MAINNET_RPC_URL").required().asString();
export const TESTNET_RPC_URL = env.get("TESTNET_RPC_URL").required().asString();

export const PRIVATE_KEY = env.get("PRIVATE_KEY").required().asString();

export const WALLET_ADDRESS = env.get("WALLET_ADDRESS").required().asString();

export const CLOB_API_URL = env.get("CLOB_API_URL").required().asString();
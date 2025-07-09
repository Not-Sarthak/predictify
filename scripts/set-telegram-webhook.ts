/**
 * IMP: Use -p flag for setting production webhook
 */

import { configDotenv, DotenvParseOutput } from "dotenv";

const isProd = process.argv.includes("-p");
const envFile = isProd ? ".env.production" : ".env";

const { parsed: env, error } = configDotenv({ path: envFile });

if (!env || error) {
    throw new Error("Failed to load Environment Variables: ", {
        cause: error?.cause,
    });
}

console.log(`🔧 Loaded env from: ${envFile}`);

async function setTelegramBotWebhook(env: DotenvParseOutput) {
    try {
        const res = await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/setWebhook`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                url: env.WEBHOOK_DOMAIN,
                secret_token: env.SECRET_TOKEN,
            }),
        });

        if (!res.ok) {
            console.error("Failed to Set Webhook");
        }

        const resData = await res.json();
        console.log(resData);
    } catch (error) {
        console.error("[SCRIPT ERROR]: ", error);
    }
}

setTelegramBotWebhook(env);

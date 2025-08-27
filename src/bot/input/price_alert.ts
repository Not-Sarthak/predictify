import type { Context } from "telegraf";

import { getUserIdFromCtx } from "../utils";
import { redisClient } from "../../lib/redis";
import { decodeMarketId } from "../../utils/encoding";
import { getMarketByConditionId } from "../../utils/polymarket/get-markets";
import { clearUserInputState } from "../input/state";
import { startPriceAlertWatcher, type PriceWatchConfig } from "../../notifier/ws/price-watcher";
import { getUserLanguage } from "../../helpers/user-language";
import { t } from "../../i18n";

export async function handleSetMarketPriceAlert(ctx: Context, textMessage: string) {
    const userId = getUserIdFromCtx(ctx);
    const data = textMessage.split(/\s+/);

    if (data.length !== 2) {
        return ctx.reply(
            "❌ Invalid Input. Please Try again with the format: <code>0.7</code> <code>No</code>",
            { parse_mode: "HTML" }
        );
    }

    const price = parseFloat(data[0]);
    const side = data[1].toLowerCase();

    if (isNaN(price) || (side !== "yes" && side !== "no")) {
        return ctx.reply(
            "❌ Invalid Input. Please Try again with the format: <code>0.7</code> <code>No</code>",
            { parse_mode: "HTML" }
        );
    }

    if (price <= 0 || price >= 1) {
        return ctx.reply("⚠️ Price must be between 0.0 and 1.0", { parse_mode: "HTML" });
    }

    clearUserInputState(userId.toString());

    const orderContext = await redisClient.hGetAll(`user:order_context:${userId}`);

    const { marketId } = orderContext;
    const decodedMarketId = decodeMarketId(marketId);

    const market = await getMarketByConditionId(decodedMarketId);
    const clobTokenIds = JSON.parse(market.clobTokenIds);

    const assetId = side === "yes" ? clobTokenIds[0] : clobTokenIds[1];

    const alertConfig: PriceWatchConfig = {
        type: "alert",
        price,
        outcome: side,
    };

    startPriceAlertWatcher(userId.toString(), decodedMarketId, assetId, alertConfig);

    const language = await getUserLanguage(userId);

    return ctx.reply(
        `🔔 <b>${await t("priceAlertSetSuccessfully", language)}</b>

<b>${await t("marketLabel", language)}</b> ${market.question}
<b>${await t("side", language)}</b> ${side.toUpperCase()}

<b>${await t("alertAtPrice", language)}</b> ${price}

${await t("notificationWhenMet", language)}`,
        { parse_mode: "HTML" }
    );
}

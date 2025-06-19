import { bot } from "../../config/bot";
import { Markup } from "telegraf";
import type { MarketData } from "../../types/market-data";
import { truncate } from "../../helpers/truncate";
import { generateTradeButtons } from "./button-generators";

export async function sendNotification(
  userId: string,
  market: MarketData,
  category: string
) {
  const caption = `

<b>🆕 ${truncate(market.question, 200)}</b>

<b>📝 Description</b>
${truncate(market.description, 500)}

<b>📂 Category:</b> ${category}
<b>🕒 Start:</b> ${new Date(market.startDate).toLocaleString()}
<b>⏳ End:</b> ${new Date(market.endDate).toLocaleString()}
<b>💧 Liquidity:</b> $${(market.liquidity || 0).toLocaleString()}
<b>📊 Volume (24h):</b> $${(market.volume || 0).toLocaleString()}

<a href="https://polymarket.com/event/${encodeURIComponent(
    market.slug
  )}">🔗 View Full Market</a>
`.trim();

  const inlineKeyboard = Markup.inlineKeyboard(
    generateTradeButtons(market.id)
  ).reply_markup;

  try {
    await bot.telegram.sendPhoto(userId, market.image, {
      caption,
      parse_mode: "HTML",
      reply_markup: inlineKeyboard,
    });
  } catch (error) {
    console.error(`Failed to Send Photo to ${userId}:`, error);
  }
}

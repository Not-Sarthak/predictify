import { Markup } from "telegraf";
import { CATEGORY_LIST } from "../constants/polymarket";

export function generateButtons(action: "subscribe" | "unsubscribe") {
  const buttons = CATEGORY_LIST.map((cat) =>
    Markup.button.callback(
      `${action === "subscribe" ? "🔔" : "🔕"} ${cat}`,
      `${action}_${cat}`
    )
  );

  const layout = [];
  for (let i = 0; i < buttons.length; i += 2) {
    layout.push(buttons.slice(i, i + 2));
  }

  return layout;
}
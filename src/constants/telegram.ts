import type { BotCommand } from "telegraf/types";
import { generateButtons } from "../utils/generate-buttons";

// Buttons
export const SUBSCRIBE_BUTTONS = generateButtons("subscribe");
export const UNSUBSCRIBE_BUTTONS = generateButtons("unsubscribe");

// Messages
export const SUBSCRIBE_MESSAGE = "Choose a Category to Subscribe to";
export const UNSUBSCRIBE_MESSAGE = "Choose a Category to Unsubscribe from";
export const NO_SUBSCRIPTIONS_MESSAGE = "You have no Active Subscriptions.";
export const SUBSCRIBED_MESSAGE = (category: string) =>
  `🔔 Subscribed to ${category}`;
export const UNSUBSCRIBED_MESSAGE = (category: string) =>
  `🔕 Unsubscribed from ${category}`;
export const ACTIVE_SUBSCRIPTIONS_MESSAGE = (categories: string[]) =>
  `You're Subscribed To:\n• ${categories.join("\n• ")}`;

// Commands
export const botCommands: BotCommand[] = [
  {
    command: "subscribe",
    description: "Select a Category to Subscribe To",
  },
  {
    command: "unsubscribe",
    description: "Select a Category to Unsubscribe From",
  },
  {
    command: "mysubscriptions",
    description: "View your Active Subscriptions",
  },
];

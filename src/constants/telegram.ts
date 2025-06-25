import type { BotCommand } from "telegraf/types";
import { generateSubscriptionButtons } from "../utils/telegram";

// Buttons
export const SUBSCRIBE_BUTTONS = generateSubscriptionButtons("subscribe");
export const UNSUBSCRIBE_BUTTONS = generateSubscriptionButtons("unsubscribe");

// Messages
export const SUBSCRIBE_MESSAGE = "Choose a Category to Subscribe to";
export const UNSUBSCRIBE_MESSAGE = "Choose a Category to Unsubscribe from";
export const NO_SUBSCRIPTIONS_MESSAGE = "You have no Active Subscriptions.";
export const SUBSCRIBED_MESSAGE = (category: string) => `🔔 Subscribed to ${category}`;
export const UNSUBSCRIBED_MESSAGE = (category: string) => `🔕 Unsubscribed from ${category}`;
export const ACTIVE_SUBSCRIPTIONS_MESSAGE = (categories: string[]) =>
    `You're Subscribed To:\n• ${categories.join("\n• ")}`;

// Commands
export const botCommands: BotCommand[] = [
    {
        command: "start",
        description: "Start the bot",
    },
];

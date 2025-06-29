import type { BotCommand } from "telegraf/types";

// Bot Interaction Commands
export const botCommands: BotCommand[] = [
    {
        command: "start",
        description: "Get started and see what this bot can do",
    },
    {
        command: "subscriptions",
        description: "View and manage your market subscriptions",
    },
    {
        command: "trade",
        description: "Manually place a market trade",
    },
    {
        command: "autotrade",
        description: "Enable or configure copy trading from wallets",
    },
    {
        command: "settings",
        description: "Update preferences like wallet or notification settings",
    },
];

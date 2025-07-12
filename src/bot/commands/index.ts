import type { BotCommand } from "telegraf/types";

// TODO:FIX - REFACTOR COMMAND HANDLERS
export * from "./autotrade";
export * from "./settings";
export * from "./start";
export * from "./subscriptions";
export * from "./trade";

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
        command: "fund",
        description: "Update preferences like wallet or notification settings",
    },
    {
        command: "history",
        description: "View your Trade History",
    },
    {
        command: "portfolio",
        description: "View your Portfolio",
    },
    {
        command: "cancel",
        description: "Cancel your Current Open Orders",
    },
];

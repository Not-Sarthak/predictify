import type { BotCommand } from "telegraf/types";

export * from "./settings";
export * from "./start";
export * from "./subscriptions";
export * from "./trade";
export * from "./watchlist";
export * from "./high-probability";
export * from "./referral";
export * from "./health";
export * from "./test-pol";

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
        command: "manage",
        description: "Manage your Open Limit Orders",
    },
    {
        command: "stats",
        description: "View your Trading Stats",
    },
    {
        command: "watchlist",
        description: "View your favorite markets watchlist",
    },
    {
        command: "highprob",
        description: "Trade high-probability markets (85-95% odds)",
    },
    {
        command: "ref",
        description: "View referral stats and share your referral link",
    },
    {
        command: "health",
        description: "Test database connectivity (for troubleshooting)",
    },
    {
        command: "test_pol",
        description: "[Admin] Test POL auto-acquisition feature",
    },
    {
        command: "check_prices",
        description: "[Admin] Check current SOL/POL prices",
    },
];

import type { BotCommand } from "telegraf/types";
import { t } from "../../i18n";

export * from "./settings";
export * from "./start";
export * from "./subscriptions";
export * from "./trade";
export * from "./watchlist";
export * from "./high-probability";
export * from "./referral";
export * from "./detailed-analytics";
export * from "./notify-all";
export * from "./health";
export const getBotCommands = (locale: string = "zh"): BotCommand[] => [
    {
        command: "start",
        description: t("cmdStart", locale as any),
    },
    {
        command: "subscriptions",
        description: t("cmdSubscriptions", locale as any),
    },
    {
        command: "trade",
        description: t("cmdTrade", locale as any),
    },
    {
        command: "autotrade",
        description: t("cmdAutotrade", locale as any),
    },
    {
        command: "fund",
        description: t("cmdFund", locale as any),
    },
    {
        command: "history",
        description: t("cmdHistory", locale as any),
    },
    {
        command: "portfolio",
        description: t("cmdPortfolio", locale as any),
    },
    {
        command: "manage",
        description: t("cmdManage", locale as any),
    },
    {
        command: "stats",
        description: t("cmdStats", locale as any),
    },
    {
        command: "watchlist",
        description: t("cmdWatchlist", locale as any),
    },
    {
        command: "highprob",
        description: t("cmdHighprob", locale as any),
    },
    {
        command: "ref",
        description: t("cmdRef", locale as any),
    },
    {
        command: "redeem",
        description: t("cmdRedeem", locale as any),
    },
    {
        command: "health",
        description: t("cmdHealth", locale as any),
    },
];
// Bot Interaction Commands (default Chinese)
export const botCommands: BotCommand[] = getBotCommands("zh");

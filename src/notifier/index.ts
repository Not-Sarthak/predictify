import { CronJob } from "cron";
import { notifyUsersAboutNewMarkets } from "./job";
import { handleCronError } from "./utils";

const notifierJob = CronJob.from({
    cronTime: "0 */12 * * *", // Every 12 Hours UTC
    onTick: async () => {
        try {
            await notifyUsersAboutNewMarkets();
        } catch (err) {
            handleCronError(err, "notifyUsersAboutNewMarkets");
        }
    },
    start: false,
    timeZone: "Etc/UTC",
    runOnInit: false,
    errorHandler: (err: any) => handleCronError(err, "GlobalCronHandler"),
});

export { notifierJob as notifier };

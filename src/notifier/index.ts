import { CronJob } from "cron";
import { notifyUsersAboutNewMarkets } from "@/notifier/job";
import { handleCronError } from "@/notifier/error";

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
    runOnInit: true,
    errorHandler: (err) => handleCronError(err, "GlobalCronHandler"),
});

export { notifierJob as cron };

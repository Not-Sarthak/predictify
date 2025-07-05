import type { TableRow } from "@/shared/types/supabase";

import { supabase } from "@/lib/supabase";
import {
    addWalletMonitor,
    deleteWalletMonitor,
    updateWalletMonitor,
} from "@/watcher/monitor-handlers";

export const channel = supabase
    .channel("copy_wallets_changes")
    .on(
        "postgres_changes",
        { table: "Copy_Wallets", event: "*", schema: "public" },
        async ({ eventType, old, new: newData, errors }) => {
            if (errors) {
                for (const error of errors) {
                    console.log("[WATCHER ERROR]: ", error);
                }
            }

            const data = (
                newData && Object.keys(newData).length > 0 ? newData : old
            ) as TableRow<"Copy_Wallets">;

            if (eventType === "INSERT") {
                await addWalletMonitor(data);
            } else if (eventType === "UPDATE") {
                await updateWalletMonitor(data);
            } else {
                await deleteWalletMonitor(data);
            }
        }
    );

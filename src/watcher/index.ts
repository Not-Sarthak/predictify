import type { TableRow } from "@/shared/types/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import {
    addWalletMonitor,
    deleteWalletMonitor,
    resumeAllWalletMonitors,
    updateWalletMonitor,
} from "@/watcher/monitor-handlers";

const CHANNEL_NAME = "copy_wallets_changes";
const TABLE_NAME = "Copy_Wallets";

let channel: RealtimeChannel;

export const subscribe = async () => {
    channel = supabase
        .channel(CHANNEL_NAME)
        .on(
            "postgres_changes",
            { table: TABLE_NAME, event: "*", schema: "public" },
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

    channel.subscribe(async (status, err) => {
        console.log("[SUBSCRIPTION STATUS]:", status);

        if (err) {
            console.error("[REALTIME ERROR]:", err);
        }

        if (status === "CHANNEL_ERROR" || status === "CLOSED") {
            console.warn("[REALTIME] Channel closed or errored. Reconnecting in 2s...");
            await supabase.removeChannel(channel);

            setTimeout(() => {
                subscribe();
            }, 2000);
        }
    });
};

export const connectToSupabaseRealtime = async () => {
    await resumeAllWalletMonitors();

    console.log("Connecting to Supabase Realtime...");

    try {
        // Ensure Socket Connection
        supabase.realtime.connect();
        await subscribe();
        console.log("Connected to Supabase Realtime");
    } catch (error) {
        console.error("[REALTIME CONNECT ERROR]: ", error);
    }
};

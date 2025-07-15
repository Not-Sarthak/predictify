import type { TableRow } from "@/types/supabase";
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

let channel: RealtimeChannel | null = null;
let retrying = false;
let retryCount = 0;
const MAX_RETRIES = 5;
const RETRY_BASE_DELAY = 2000; // 2 seconds

export const subscribe = async () => {
    if (channel) {
        await supabase.removeChannel(channel);
        channel = null;
    }

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

                try {
                    if (eventType === "INSERT") {
                        await addWalletMonitor(data);
                    } else if (eventType === "UPDATE") {
                        await updateWalletMonitor(data);
                    } else if (eventType === "DELETE") {
                        await deleteWalletMonitor(data);
                    }
                } catch (err) {
                    console.error(`[HANDLER ERROR - ${eventType}]:`, err);
                }
            }
        );

    channel.subscribe(async (status, err) => {
        console.log("[SUBSCRIPTION STATUS]:", status);

        if (err) {
            console.error("[REALTIME ERROR]:", err);
        }

        if (status === "CHANNEL_ERROR" || status === "CLOSED") {
            if (retryCount >= MAX_RETRIES) {
                console.error("[REALTIME] Max retries reached. Giving up.");
                return;
            }

            retryCount++;
            const retryDelay = RETRY_BASE_DELAY * retryCount;

            console.warn(
                `[REALTIME] Channel closed or errored. Retrying in ${retryDelay / 1000}s...`
            );
            await supabase.removeChannel(channel as RealtimeChannel);
            channel = null;

            if (!retrying) {
                retrying = true;
                setTimeout(async () => {
                    retrying = false;
                    await subscribe(); // retry
                }, retryDelay);
            }
        } else if (status === "SUBSCRIBED") {
            retryCount = 0; // reset on success
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

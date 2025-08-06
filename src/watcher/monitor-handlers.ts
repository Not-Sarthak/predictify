import type { TableRow } from "../types/supabase";
import {
    startWalletMonitoring,
    stopWalletMonitoring,
    updateSubscription,
} from "../watcher/copy-trade";
import { supabase } from "../lib/supabase";

export const addWalletMonitor = async (data: TableRow<"Copy_Wallets">) => {
    const { is_enabled, user_id, wallet_address, percent_ratio } = data;

    // Get user's copy trading settings
    const { data: user } = await supabase
        .from("Users")
        .select("is_copytrading_enabled, config_value")
        .eq("id", user_id)
        .single();

    if (!user) {
        console.error(`User ${user_id} not found`);
        return;
    }

    const positionPercentage =
        percent_ratio * 100 || (user.config_value ? parseInt(user.config_value) : 100);

    // Use the user-specific monitoring from copy-trade.ts
    await startWalletMonitoring(
        wallet_address,
        Number(user_id),
        is_enabled && user.is_copytrading_enabled,
        positionPercentage
    );

    console.log(`🟢 Started monitoring ${wallet_address} for user ${user_id}`);
};

export const updateWalletMonitor = async (data: TableRow<"Copy_Wallets">) => {
    const { is_enabled, user_id, wallet_address, percent_ratio } = data;

    // Get user's copy trading settings
    const { data: user } = await supabase
        .from("Users")
        .select("is_copytrading_enabled, config_value")
        .eq("id", user_id)
        .single();

    if (!user) {
        console.error(`User ${user_id} not found`);
        return;
    }

    const positionPercentage =
        percent_ratio * 100 || (user.config_value ? parseInt(user.config_value) : 100);

    // Update the user-specific monitoring
    await updateSubscription(
        wallet_address,
        Number(user_id),
        is_enabled && user.is_copytrading_enabled,
        positionPercentage
    );

    console.log(`🔄 Updated monitor for user ${user_id} on wallet ${wallet_address}`);
};

export const deleteWalletMonitor = async (data: TableRow<"Copy_Wallets">) => {
    const { user_id, wallet_address } = data;

    // Stop user-specific monitoring
    await stopWalletMonitoring(wallet_address, Number(user_id));

    console.log(`🔴 Stopped monitoring ${wallet_address} for user ${user_id}`);
};

export const resumeAllWalletMonitors = async () => {
    console.log("Resuming wallet monitors is now handled by copy-trade.ts");
    // This is now handled by resumeAllMonitoring in copy-trade.ts
    // which is called from init.ts
};

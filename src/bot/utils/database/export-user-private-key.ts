import type { Context } from "telegraf";
import { supabase } from "../../../lib/supabase";

export async function handleExportPrivateKey(ctx: Context, network: "evm" | "solana") {
    const userId = ctx.from?.id!;
    const privateKeyToExport = network === "evm" ? "private_key" : "solana_private_key";

    const { data, error } = await supabase
        .from("Users")
        .select(privateKeyToExport)
        .eq("id", userId)
        .single();

    if (error) {
        return ctx.reply("Error exporting your private key. Please try again later.");
    }

    let privateKey;

    if (network === "evm") {
        privateKey = (data as { private_key: string }).private_key;
    } else {
        privateKey = (data as { solana_private_key: string }).solana_private_key;
    }

    return ctx.reply(`Your ${network === "evm" ? "EVM" : "Solana"} Private Key: ${privateKey}`);
}

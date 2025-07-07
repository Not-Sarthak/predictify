import type { Context } from "telegraf";
import { supabase } from "../../../lib/supabase";
import { getUserIdFromCtx } from "@/bot/utils/get-user-id-ctx";
import { decryptPrivateKey } from "@/utils/crypto";

export async function handleExportPrivateKey(ctx: Context, network: "evm" | "solana") {
    const userId = getUserIdFromCtx(ctx);
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

    const decryptedPrivateKey = decryptPrivateKey(privateKey);

    return ctx.reply(
        `Your ${network === "evm" ? "EVM" : "Solana"} Private Key: <tg-spoiler>${decryptedPrivateKey}</tg-spoiler>`,
        {
            parse_mode: "HTML",
        }
    );
}

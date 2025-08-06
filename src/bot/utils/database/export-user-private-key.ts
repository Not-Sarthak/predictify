import type { Context } from "telegraf";
import { supabase } from "../../../lib/supabase";
import { getUserIdFromCtx } from "../../utils/get-user-id-ctx";
import { decodePrivateKey, decryptPrivateKey } from "../../../utils/crypto";

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

    let encryptedPrivateKey: string;
    if (network === "evm") {
        encryptedPrivateKey = (data as { private_key: string }).private_key;
    } else {
        encryptedPrivateKey = (data as { solana_private_key: string }).solana_private_key;
    }

    const decryptedPrivateKey = decryptPrivateKey(encryptedPrivateKey);

    if (network === "solana") {
        try {
            const _keypair = decodePrivateKey(decryptedPrivateKey); // creates Keypair to verify it's valid
        } catch (err) {
            console.error("Failed to decode Solana Private Key: ", err);
            return ctx.reply("Failed to decode your Solana private key.");
        }
    }

    return ctx.reply(
        `Your ${network === "evm" ? "EVM" : "Solana"} Private Key: <tg-spoiler>${decryptedPrivateKey}</tg-spoiler>`,
        {
            parse_mode: "HTML",
        }
    );
}

import type { Context } from "telegraf";
import { supabase } from "../config/supabase";

export async function handleExportPrivateKey(ctx: Context) {
  const userId = ctx.from?.id;

  const { data, error } = await supabase
    .from("Users")
    .select("private_key")
    .filter("id", "eq", userId)
    .single();

  if (error) {
    return ctx.reply(
      "Error exporting your private key. Please try again later."
    );
  }

  return ctx.reply(`Your Private Key: ${data.private_key}`);
}

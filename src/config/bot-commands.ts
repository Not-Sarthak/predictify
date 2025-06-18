import { Context, Markup } from "telegraf";
import { redisClient } from "./redis";
import { 
  SUBSCRIBE_BUTTONS, 
  UNSUBSCRIBE_BUTTONS,
  SUBSCRIBE_MESSAGE,
  UNSUBSCRIBE_MESSAGE,
  NO_SUBSCRIPTIONS_MESSAGE,
  ACTIVE_SUBSCRIPTIONS_MESSAGE
} from "../constants/telegram";

/* Commands */

// Subscribe: Allows the User to Subscribe to a Category
export async function handleSubscribeCommand(ctx: Context) {
  return ctx.reply(
    SUBSCRIBE_MESSAGE,
    Markup.inlineKeyboard(SUBSCRIBE_BUTTONS)
  );
}

// Unsubscribe: Allows the User to Unsubscribe from a Category
export async function handleUnsubscribeCommand(ctx: Context) {
  return ctx.reply(
    UNSUBSCRIBE_MESSAGE,
    Markup.inlineKeyboard(UNSUBSCRIBE_BUTTONS)
  );
}

// MySubscriptions: Allows the User to View their Active Subscriptions
export async function handleMySubscriptionsCommand(ctx: Context) {
  const userId = ctx.chat?.id.toString();
  if (!userId) return;

  const categories: string[] = [];
  const keys = await redisClient.keys("subscriptions:*");

  for (const key of keys) {
    const isMember = await redisClient.sIsMember(key, userId);
    if (isMember) {
      categories.push(key.split(":")[1]);
    }
  }

  if (categories.length === 0) {
    return ctx.reply(NO_SUBSCRIPTIONS_MESSAGE);
  }

  return ctx.reply(ACTIVE_SUBSCRIPTIONS_MESSAGE(categories));
}

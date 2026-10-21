# Predictify

A Telegram bot for trading Polymarket from chat. Each user gets a custodial Polygon and Solana
wallet, funds it from Solana in one step, and trades prediction markets with market orders, limit
orders, take profit, stop loss, price alerts and copy trading.

It ran with 2.5k+ users and $100k+ in volume.

- Orders go through the Polymarket CLOB client: FOK market buys and sells, GTC limit orders,
  cancels, redemptions (including neg-risk markets) and allowance management.
- Funding bridges SOL on Solana into USDC on Polygon through Mayan, and tops up POL for gas through
  deBridge when the wallet is low.
- Fills, PnL and positions are rendered server-side as image cards with satori.
- English and Chinese, with Chinese commands by default.

## How it fits together

```
telegram ──webhook──▶ bot/            commands, callbacks, text input
                        │
                        ├─▶ utils/polymarket-order    clob orders
                        ├─▶ utils/mayan, debridge     solana → polygon funding
                        └─▶ notifier/ws               one websocket per watch
                                ├─ price-watcher        market channel: alerts, tp/sl
                                └─ limit-order-watcher  user channel: limit order fills

watcher/          polls copied wallets every 5s and mirrors their trades
notifier/         12-hourly new market digest, 10-minute high-probability alerts
redis             input state, order context, watcher registry, locks
supabase          users, encrypted keys, trades, referrals, stats
sqs               manually placed orders, for downstream processing
```

Watchers are persisted in Redis and restored on boot, so a deploy doesn't drop anyone's alerts,
stops or open limit orders.

## Failure handling

The parts that move money are written for the cases where something goes wrong halfway:

- **Placing an order is single-flight per user.** A Redis lock is held for the whole placement, so
  two messages sent in quick succession can't both read the order context and place it twice.
- **Replacing a limit order validates the new one first**, then cancels the old one.
- **Take profit and stop loss trigger off the best bid** and execute as a FAK market sell. They are
  level-based rather than crossing-based, so a price that moved through the level while the bot was
  down still triggers on the first book after the watcher is restored. A failed sell is reported to
  the user instead of being announced as executed.
- **Price alerts fire on a touch or a cross**, so a jump straight past the level still alerts.
- **Limit orders are followed through partial fills.** Each confirmed trade is de-duplicated in
  Redis, the user is told their own share of it, and the watcher stays up until nothing in that
  market is still open.
- **Fees are charged on what fills.** A resting limit order is billed per fill, not at placement.
- **The acting user always comes from the Telegram update**, never from callback data, which a
  client can forge.
- **A double tap can't repeat an action.** Bridge quotes are taken before the first await and
  expire after two minutes, and admin broadcasts are claimed with `GETDEL`.

## Running it

```sh
bun install
cp .env.example .env    # fill in the values
bun run dev             # watch mode
bun run set:wh          # point the telegram webhook at WEBHOOK_DOMAIN
```

`bun run build` bundles to `dist/` with tsup, and the Dockerfile builds with Bun and runs on Node.
Pushes to `dev` build and push the image and deploy staging; pushes to `main` restart production on
the latest image.

## Checks

```sh
bun test            # trigger and fill logic
bun run typecheck
bun run lint
bun run format:check
```

CI runs all four on every push and pull request.

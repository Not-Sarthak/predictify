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
telegram ──webhook──▶ bot/
                        │
                        ├─▶ utils/polymarket-order
                        ├─▶ utils/mayan, debridge
                        └─▶ notifier/ws
                                ├─ price-watcher
                                └─ limit-order-watcher

watcher/
notifier/
redis
supabase
sqs
```

Watchers are persisted in Redis and restored on boot, so a deploy doesn't drop anyone's alerts,
stops or open limit orders.

## Running it

```sh
bun install
cp .env.example .env    # fill in the values
bun run dev             # watch mode
bun run set:wh          # point the telegram webhook at WEBHOOK_DOMAIN
```

Run `bun run migrate:api-creds` once against an existing database to encrypt API credentials that
were stored before encryption.

`bun run build` bundles to `dist/` with tsup, and the Dockerfile builds with Bun and runs on Node.
Pushes to `dev` build and push the image and deploy staging; pushes to `main` restart production on
the latest image.

## Checks

```sh
bun test            # triggers, fills, credential encryption
bun run typecheck
bun run lint
bun run format:check
```

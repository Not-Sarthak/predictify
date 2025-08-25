# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Telegram bot for trading on Polymarket, integrating with their CLOB API to provide trading functionality directly through Telegram. The bot supports manual trading, copy trading, wallet management, and real-time notifications.

## Key Technologies

- **Runtime**: Bun (development), Node.js (production)
- **Language**: TypeScript with strict mode
- **Package Manager**: pnpm (as specified in package.json)
- **Bot Framework**: Telegraf
- **Database**: Supabase (PostgreSQL)
- **Cache**: Redis
- **Blockchain**: Ethers.js for Ethereum/Polygon
- **Build Tool**: tsup
- **UI Rendering**: React with Satori for image generation

## Development Commands

### Setup and Build

```bash
bun install              # Install dependencies
bun run build           # Build with tsup
bun run dev             # Run in development mode with watch
bun run start           # Run production build
```

### Code Quality

```bash
bun run lint            # Run ESLint
bun run lint:fix        # Auto-fix ESLint issues
bun run format          # Format with Prettier
bun run format:check    # Check formatting
```

### Database

```bash
bun run scripts/supabase-typegen.ts    # Generate TypeScript types from Supabase schema
```

### Deployment

```bash
bun run set:wh          # Set Telegram webhook (prod)
```

## Architecture Overview

### Directory Structure

- `src/bot/` - Telegram bot logic
    - `commands/` - Bot command handlers (/start, /trade, etc.)
    - `callbacks/` - Button callback handlers
    - `ui/` - UI components and message formatting
    - `middlewares/` - Bot middleware (auth, error handling)
- `src/utils/` - Utility functions
    - `polymarket/` - Polymarket-specific operations
    - `polymarket-order/` - Order management logic
    - `debridge/` - Cross-chain bridging
    - `components/` - React components for UI rendering
- `src/watcher/` - Real-time monitoring for copy trading
- `src/notifier/` - Notification system and cron jobs
- `src/helpers/` - Helper utilities for contract operations
- `src/config/` - Environment configuration with Zod validation
- `src/types/` - TypeScript type definitions including Supabase generated types
- `src/shared/` - Shared constants, ABIs, errors
- `src/lib/` - External service configurations (Redis, Supabase)

### Key Patterns

1. **State Management**: Uses Sets for tracking user input states, Redis for sessions
2. **Error Handling**: Custom error classes (APIError, DBError) with global handlers  
3. **Type Safety**: Comprehensive TypeScript usage with generated Supabase types
4. **Security**: Private key encryption, environment-based config
5. **Real-time**: Supabase subscriptions for copy trading updates
6. **Service Architecture**: Single main process managing bot, notifier, watchers, and alerts
7. **Webhook-based**: Uses Telegram webhooks instead of polling for better performance

### Application Bootstrap

The main entry point (`src/index.ts`) initializes services in this order:
1. **Cron Jobs**: Starts market data fetching every 12 hours
2. **Watcher Restoration**: Restores price alerts, TP/SL watchers, and limit order watchers from Redis
3. **High-Prob Alerts**: Starts high-probability market monitoring
4. **Copy Trading System**: Initializes wallet monitoring via `initializeCopyTrading()`
5. **Telegram Bot**: Launches with webhook configuration on configurable port

### Database Schema

- `Users` - User profiles with encrypted wallet private keys
- `Auto_Trade` - Copy trading execution tracking
- `Copy_Wallets` - Wallets to monitor for copy trading
- `wallet_subscriptions` - Market notification preferences

### Bot Commands

- `/start` - User onboarding with referral tracking
- `/trade` - Manual trading interface
- `/autotrade` - Configure copy trading
- `/fund` - Wallet funding and management
- `/subscriptions` - Market notifications
- `/settings` - User preferences
- `/ref` - Referral program
- `/highprob` - High-probability market filtering and trading
- `/watchlist` - Market watchlist management
- `/history` - Trading history
- `/portfolio` - View trading positions
- `/manage` - Manage limit orders
- `/stats` - User profile statistics
- `/monitoring` - Copy trading monitoring stats
- `/statistics` - Bot statistics (admin)
- `/analytics` - Active user analytics (admin)
- `/detailed` - Detailed analytics (admin)

### Environment Variables

Required environment variables are validated in `src/config/env.schema.ts` using Zod schemas. Key variables include:

- `REDIS_URL` - Redis connection string
- `TG_BOT_TOKEN` - Bot token from BotFather  
- `SECRET_TOKEN` - Webhook secret token (min 16 chars)
- `WEBHOOK_DOMAIN` - Domain for webhook endpoint
- `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY` - Database credentials
- `MAINNET_RPC_URL` - Blockchain RPC endpoint
- `CLOB_API_URL` - Polymarket API endpoint
- `PRIVATE_KEY_ENCRYPTION_KEY` - For private key encryption (32 chars)
- `USDC_CONTRACT_ADDRESS` - USDC contract address
- `TREASURY_ADDRESS` - Treasury wallet address
- `DEBRIDGE_API_URL` & `DEBRIDGE_API_KEY` - Cross-chain bridging
- `PROJECT_ID` & `SUPABASE_ACCESS_TOKEN` - For type generation
- `DB_RETRY_COUNT` & `DB_TIMEOUT_MS` - Database connection settings

### Bot Architecture

The bot uses Telegraf framework with:
- **Middleware Stack**: Bot rejection, ID requirements
- **Command Routing**: Declarative command registration in `src/bot/index.ts`
- **Input Handling**: Text input processing via `handleUserTextMessage`
- **Callback Queries**: Button interactions via `handleCallbackQuery`
- **Error Handling**: Global error catching with context logging

### State Management System

- **User Input States**: Tracked via Sets for active input sessions
- **Redis Sessions**: Persistent state storage for complex workflows
- **Database State**: User preferences, trading configs, wallet data
- **Real-time Updates**: Supabase subscriptions for copy trading events

### Trading System Architecture

1. **Manual Trading**: Direct user interaction through `/trade` command
2. **Copy Trading**: Automated execution based on monitored wallets
3. **High-Probability Trading**: Filtered market trading via `/highprob`
4. **Order Management**: Limit orders, market orders, TP/SL functionality
5. **Portfolio Management**: Position tracking, PnL calculation

### Deployment

- Single-process architecture (no separate API server)
- Webhook-based bot updates (not polling) using `PORT` from constants
- Environment-specific webhook configuration
- Service restoration includes price watchers, limit order watchers, and copy trading monitors

### Important Notes

- Always encrypt private keys before storage using `PRIVATE_KEY_ENCRYPTION_KEY`
- Environment validation is strict - all required vars must pass Zod schema validation
- The application bootstraps multiple services: cron jobs, watchers, alerts, then the bot
- Copy trading uses Supabase real-time subscriptions for immediate execution
- When working with Supabase types, regenerate using the typegen script after schema changes

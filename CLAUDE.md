# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Telegram bot for trading on Polymarket, integrating with their CLOB API to provide trading functionality directly through Telegram. The bot supports manual trading, copy trading, wallet management, and real-time notifications.

## Key Technologies

- **Runtime**: Bun (development), Node.js (production)
- **Language**: TypeScript with strict mode
- **Bot Framework**: Telegraf
- **API Server**: Fastify
- **Database**: Supabase (PostgreSQL)
- **Cache**: Redis
- **Blockchain**: Ethers.js for Ethereum/Polygon

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
bun run db:typegen      # Generate TypeScript types from Supabase schema
```

### Deployment

```bash
bun run set:wh          # Set Telegram webhook
```

## Architecture Overview

### Directory Structure

- `src/bot/` - Telegram bot logic
    - `commands/` - Bot command handlers (/start, /trade, etc.)
    - `callbacks/` - Button callback handlers
    - `ui/` - UI components and message formatting
    - `middlewares/` - Bot middleware (auth, error handling)
- `src/api/` - Fastify REST API server
- `src/utils/` - Utility functions
    - `polymarket/` - Polymarket-specific operations
    - `polymarket-order/` - Order management logic
    - `debridge/` - Cross-chain bridging
- `src/watcher/` - Real-time monitoring for copy trading
- `src/config/` - Environment configuration with Zod validation
- `src/types/` - TypeScript type definitions
- `src/shared/` - Shared constants, ABIs, errors

### Key Patterns

1. **State Management**: Uses Sets for tracking user input states, Redis for sessions
2. **Error Handling**: Custom error classes (APIError, DBError) with global handlers
3. **Type Safety**: Comprehensive TypeScript usage with generated Supabase types
4. **Security**: Private key encryption, environment-based config
5. **Real-time**: Supabase subscriptions for copy trading updates

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

### Environment Variables

Required environment variables are validated in `src/config/env.schema.ts`. Key variables include:

- `REDIS_URL` - Redis connection string
- `TG_BOT_TOKEN` - Bot token from BotFather
- `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY` - Database credentials
- `MAINNET_RPC_URL` - Blockchain RPC endpoint
- `CLOB_API_URL` - Polymarket API endpoint
- `PRIVATE_KEY_ENCRYPTION_KEY` - For private key encryption

### Common Development Tasks

#### Adding a New Command

1. Create handler in `src/bot/commands/`
2. Register in `src/bot/index.ts`
3. Add UI components in `src/bot/ui/`
4. Update types if needed

#### Modifying Trading Logic

1. Core logic in `src/utils/polymarket/`
2. Order management in `src/utils/polymarket-order/`
3. Update error handling in `src/shared/errors.ts`

#### Working with Copy Trading

1. Watcher logic in `src/watcher/`
2. Uses Supabase real-time subscriptions
3. State managed through database tables

### Testing Approach

Currently no automated tests. Manual testing through:

1. Local bot instance with test Telegram account
2. Testnet deployment for blockchain interactions
3. Staging environment before production

### Deployment

- Docker-based deployment
- GitHub Actions CI/CD pipeline
- Webhook-based bot updates (not polling)
- Separate API server on port 4000

### Important Notes

- Always encrypt private keys before storage
- Use environment variables for sensitive data
- Follow existing code patterns for consistency
- Check README.md for current development priorities

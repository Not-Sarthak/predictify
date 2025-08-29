# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Telegram bot for Polymarket trading that provides automated trading, copy trading, price alerts, and portfolio management features. The bot integrates with Polymarket's CLOB API, Supabase database, Redis caching, and includes multi-language support.

## Development Commands

**Build & Development:**
- `bun run build` - Build the project using tsup
- `bun run dev` - Start development server with file watching
- `node dist/index.js` or `bun run start` - Run the built application

**Code Quality:**
- `bun run lint` - Run ESLint on TypeScript files
- `bun run lint:fix` - Fix ESLint issues automatically
- `bun run format` - Format code with Prettier
- `bun run format:check` - Check code formatting

**Deployment:**
- `bun run set:wh` - Set Telegram webhook (runs scripts/set-telegram-webhook.ts)
- Docker build available via Dockerfile (multi-stage build with Bun → Node)

## Architecture Overview

**Core Components:**
- `/src/bot/` - Telegram bot handlers (commands, callbacks, input processing)
- `/src/notifier/` - Background services for price alerts, high-probability market alerts, and WebSocket monitoring
- `/src/watcher/` - Copy trading system and position monitoring
- `/src/utils/polymarket/` - Polymarket API integration and trading operations
- `/src/utils/debridge/` - Cross-chain bridging functionality
- `/src/helpers/` - User data and blockchain interaction utilities

**Key Services:**
- Redis for caching and session management (`/src/lib/redis.ts`)
- Supabase for persistent data storage (`/src/lib/supabase.ts`)
- Multi-language support via i18n system (`/src/i18n/`)
- Card generation for portfolio visualization (`/src/utils/components/`)

**Bot Architecture:**
- Command handlers in `/src/bot/commands/`
- Button callback handlers in `/src/bot/callbacks/`
- Input processing and state management in `/src/bot/input/`
- Middleware for authentication and bot rejection in `/src/bot/middlewares/`

**Trading Features:**
- Market orders and limit orders via Polymarket CLOB
- Copy trading system that monitors wallets and replicates trades
- Automated high-probability market alerts
- Price alert system with TP/SL functionality
- Position management and redemption

## Configuration

Environment variables are validated via Zod schema in `src/config/env.schema.ts`. Required variables include:
- Telegram bot token, Redis URL, Supabase credentials
- Polymarket API endpoints and wallet private keys
- Database timeout and retry settings for connectivity issues

**Runtime:** Uses Bun for development, builds to Node.js for production
**Package Manager:** pnpm (configured in package.json)
**Database:** Supabase with typed schema in `/src/types/supabase/`

## Important Notes

The application handles users in regions with connectivity restrictions, implementing retry logic and extended timeouts for database connections. The bot supports Chinese and English languages with default Chinese commands due to user base demographics.
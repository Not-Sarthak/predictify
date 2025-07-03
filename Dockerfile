# ----------- Stage 1: Build with Bun -----------
FROM oven/bun:latest AS builder

WORKDIR /app

COPY tsup.config.ts package.json tsconfig.json bun.lock ./

# Install dependencies
RUN bun install tsup
RUN bun install --production --frozen-lockfile --ignore-scripts

# Copy full source for build
COPY . .

# Build the app (tsup emits dist/)
RUN bun run build


# ----------- Stage 2: Run with Node -----------
FROM node:22-alpine AS runner

WORKDIR /app

# Copy only runtime files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Copy only needed runtime deps
COPY --from=builder /app/node_modules ./node_modules

# Environment setup
ENV NODE_ENV=production

# Expose common ports
EXPOSE 3000
EXPOSE 4000
EXPOSE 8080

# Start the compiled app
CMD ["node", "dist/index.js"]

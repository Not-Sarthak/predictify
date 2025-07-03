# Stage 1: Build with slim
FROM oven/bun:alpine AS builder

WORKDIR /app

COPY bun.lock package.json ./

RUN bun install --production --frozen-lockfile --ignore-scripts

COPY . .

# Stage 2: Run with distroless
FROM oven/bun:distroless

WORKDIR /app

# Copy only required runtime files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./
COPY --from=builder /app/bun.lock ./

CMD ["bun", "start"]

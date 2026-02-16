# syntax=docker/dockerfile:1
# ──────────────────────────────────────────────────────
# Shotlin Backend — Multi-stage Production Dockerfile
# Optimized for 10GB SSD (npm cache mounts)
# ──────────────────────────────────────────────────────

# ── Stage 1: Build ──
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Stage 2: Production ──
FROM node:20-alpine AS production
WORKDIR /app

# Security: run as non-root + dumb-init for PID 1
RUN apk add --no-cache dumb-init openssl && \
  addgroup -g 1001 -S shotlin && \
  adduser -S shotlin -u 1001 -G shotlin

# Install only production dependencies
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --ignore-scripts

# Copy prisma schema + migrations for runtime
COPY prisma ./prisma
RUN npx prisma generate

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# Create uploads directory with correct permissions
RUN mkdir -p uploads && chown -R shotlin:shotlin /app

# Environment
ENV NODE_ENV=production
ENV PORT=4000

# Switch to non-root user
USER shotlin

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/ || exit 1

# Start: run migrations then start server (dumb-init handles signals properly)
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]

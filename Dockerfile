# ──────────────────────────────────────────────────────
# Shotlin Backend — Multi-stage Production Dockerfile
# ──────────────────────────────────────────────────────

# ── Stage 1: Build ──
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

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

# Security: run as non-root
RUN addgroup -g 1001 -S shotlin && \
    adduser -S shotlin -u 1001 -G shotlin

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

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

# Start: run migrations then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]

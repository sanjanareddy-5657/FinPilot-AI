# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# ── Stage 2: Runtime ─────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy only production dependencies + source
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app ./

# Uploads directory
RUN mkdir -p uploads

# Non-root user for security
RUN addgroup -S finpilot && adduser -S finpilot -G finpilot
RUN chown -R finpilot:finpilot /app

USER finpilot

EXPOSE 5000

CMD ["node", "server.js"]
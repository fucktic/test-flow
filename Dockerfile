# ============================================================
# Stage 1: Install dependencies
# ============================================================
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files and patches
COPY package.json package-lock.json ./
COPY patches/ ./patches/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# ============================================================
# Stage 2: Build the application
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js (outputs to .next/standalone via next.config.ts output: "standalone")
RUN npm run build

# ============================================================
# Stage 3: Production runner (minimal image)
# ============================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Copy standalone server bundle
COPY --from=builder /app/.next/standalone ./

# Copy static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Create persistent data directories (will be overridden by Docker volumes)
RUN mkdir -p projects skills \
  && chown -R nextjs:nodejs projects skills

USER nextjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "server.js"]

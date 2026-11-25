# syntax=docker/dockerfile:1.7
# ==========================================
# STAGE 1: Dependencies & build
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@10.12.3 --activate

# Manifests first so the dependency layer is cached across source changes.
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prefer-offline

COPY tsconfig.json next.config.mjs next-env.d.ts eslint.config.mjs ./
COPY public ./public
COPY src ./src
COPY scripts ./scripts
COPY tools ./tools

# Verify generated app registry and build standalone production bundle
RUN node scripts/gen-apps.mjs --check
RUN --mount=type=cache,id=next-cache,target=/app/.next/cache pnpm build && test ! -e /app/.next/standalone/data

# ==========================================
# STAGE 2: Production runtime (Pure Next.js Standalone on :3000)
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Install bash and python3 for PTY terminal shell support
RUN apk add --no-cache bash python3

# Uploads directory with node user permissions
RUN mkdir -p /app/data/uploads /app/data/custom && chown -R node:node /app/data && chmod -R 755 /app/data

# Standalone production output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/tools ./tools

USER node

EXPOSE 3000

CMD ["node", "server.js"]

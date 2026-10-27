# ==========================================
# STAGE 1: Dependencies & build
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Manifests first so the dependency layer is cached across source changes.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json next.config.mjs next-env.d.ts eslint.config.mjs ./
COPY public ./public
COPY src ./src
COPY scripts ./scripts
COPY tools ./tools

# Verify and build standalone production bundle
RUN pnpm verify
RUN pnpm build

# ==========================================
# STAGE 2: Production runtime (Pure Next.js Standalone on :3000)
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Uploads directory with node user permissions
RUN mkdir -p /app/data/uploads && chown -R node:node /app/data

# Standalone production output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/tools ./tools

USER node

EXPOSE 3000

CMD ["node", "server.js"]

FROM node:22-alpine AS base

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat


# ---------------------------------------------------------
# Install dependencies
# ---------------------------------------------------------
FROM base AS deps

COPY package.json package-lock.json ./

RUN npm ci


# ---------------------------------------------------------
# Build application
# ---------------------------------------------------------
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN mkdir -p public

RUN ./node_modules/.bin/prisma generate

RUN npm run build


# ---------------------------------------------------------
# Production image
# ---------------------------------------------------------
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=8585

COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Prisma schema and migration files
COPY --from=builder /app/prisma ./prisma

# Keep the full dependency tree available so prisma migrate deploy can run here.
COPY --from=deps /app/node_modules ./node_modules

EXPOSE 8585

CMD ["node", "server.js"]

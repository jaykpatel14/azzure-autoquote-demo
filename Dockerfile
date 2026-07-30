FROM node:22-alpine AS base

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat


# ---------------------------------------------------------
# Install all dependencies
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
# Production runtime
# ---------------------------------------------------------
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=8585

# Next.js standalone application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Prisma schema and migration history
COPY --from=builder /app/prisma ./prisma

# Prisma 6.19.3 CLI required for "prisma migrate deploy"
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

# Files needed by the Prisma CLI
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

EXPOSE 8585

CMD ["node", "server.js"]
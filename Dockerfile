FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public
RUN ./node_modules/.bin/prisma generate
RUN npm run build

FROM base AS migrator
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json* ./
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
COPY lib ./lib
RUN npx prisma generate

FROM base AS runner
ENV NODE_ENV=production
ENV APP_HOST=0.0.0.0
ENV PORT=8585
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server-entrypoint.js ./server-entrypoint.js
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
EXPOSE 8585
CMD ["node", "server-entrypoint.js"]

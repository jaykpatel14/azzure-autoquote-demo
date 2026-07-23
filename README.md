# Azzure AutoQuote MVP

Production-oriented starter for an AI-assisted jewelry quotation SaaS.

## Included

- Next.js App Router and TypeScript strict mode
- PostgreSQL and Prisma
- Multi-tenant data model
- Auth.js credentials authentication
- Three-pass OpenAI image analysis
- Median aggregation
- Editable metal and diamond estimates
- Metal density conversion
- Server-side pricing
- Atomic monthly usage reservation
- Stripe Checkout and Customer Portal billing
- Tenant-scoped quote persistence
- Docker Compose for local PostgreSQL
- Dockerfile for deployment
- Vitest unit and integration tests

## Prerequisites

- Node.js 20.9 or newer
- Docker Desktop on Windows or macOS, or Docker Engine and Compose on Linux
- npm

## Local Setup

1. Copy `.env.example` to `.env.local`.
2. Set `DATABASE_URL` for your local PostgreSQL instance.
3. Add a strong `AUTH_SECRET` and confirm `AUTH_URL` matches your local app URL.
4. Add your Stripe secret, webhook secret, and price/product ids in `.env.local` if you
   want billing checkout and portal flows to work locally.
5. Start PostgreSQL:

```bash
docker compose up -d
```

6. Install dependencies:

```bash
npm install
```

7. Apply migrations:

```bash
npm run db:migrate
```

8. Seed the database:

```bash
npm run db:seed
```

The seeded demo owner account is:

- Email: `owner@demojewelry.test`
- Password: `demo-password`

There is also a convenience demo login:

- Email: `test@acme.com`
- Password: `demo-password`

9. Add your OpenAI key to `OPENAI_API_KEY`.
10. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Platform Notes

### Windows / WSL

- Run Docker Desktop and keep the PostgreSQL container up before starting Next.js.
- If you use WSL, prefer running npm commands from the same shell that owns the working tree.
- If Prisma reports a locked engine file, stop stale Node processes and rerun `npm run build`.

### macOS

- Install Docker Desktop and allow it access to the project directory.
- Use the same terminal session for `docker compose`, `npm run db:migrate`, and `npm run dev`.

### Linux

- Install Docker Engine and Docker Compose.
- Start PostgreSQL with `docker compose up -d`, then run the Prisma commands from the same user account.

## Validation

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Helpful Database Commands

```bash
npm run db:reset
npm run db:seed
```

## Current MVP Limitations

- Credentials auth is implemented first; SSO and magic links can be added later
- Uploaded images are converted to a data URL and are not persisted yet
- Overages are architected but disabled by default
- S3, email delivery, PDF generation, and AWS deployment automation are still future phases
- AI visual estimates are approximate and not manufacturing specifications

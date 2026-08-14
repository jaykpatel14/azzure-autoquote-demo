# AI AutoQuote MVP

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
- Live metal spot pricing with Metals.dev fallback
- Atomic monthly usage reservation
- Stripe Checkout and Customer Portal billing
- Tenant-scoped quote persistence
- Internal Azzure admin console for support and key rotation
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

Internal Azzure admin testing account:

- Email: `admin@azzure.com`
- Password: `password123`

9. Add your OpenAI key to `OPENAI_API_KEY`.
10. Add `METALS_DEV_API_KEY` if you want live spot prices to flow into quotes.
11. Add at least one email to `AZZURE_ADMIN_EMAILS` if you want to access the internal admin console.
12. Add `APP_SETTINGS_ENCRYPTION_KEY` in production so secret runtime settings are stored encrypted.
13. Start the app:

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

## Production Deployment Checklist

Before shipping to production, make sure these are in place:

1. Set a strong `AUTH_SECRET` and `AUTH_URL` that matches the production domain.
2. Set `DATABASE_URL` to the production PostgreSQL instance.
3. Set `OPENAI_API_KEY` and confirm `OPENAI_MODEL` is the model you want to use.
4. Set `METALS_DEV_API_KEY` if you want live metal pricing in quotes.
5. Set `S3_BUCKET` and AWS credentials if you want generated PDFs stored in S3.
6. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the Stripe price/product ids.
7. Set `APP_SETTINGS_ENCRYPTION_KEY` so admin-managed secret settings are encrypted at rest.
8. Set `AZZURE_ADMIN_EMAILS` to the internal Azzure team emails that should access `/admin`.
9. Run `npm run db:migrate` against production before deploying code.
10. Run `npm run db:seed` only for fresh demo environments, not on existing customer data.
11. Run `npm run build` and confirm it passes before releasing.
12. After deploy, verify `/api/health`, `/admin`, `/settings`, and a sample quote flow.

Recommended runtime checks:

- Confirm admin logins redirect to `/admin`.
- Confirm customer logins land on the workspace dashboard.
- Confirm live metals pricing falls back cleanly when `METALS_DEV_API_KEY` is absent.
- Confirm Stripe checkout and webhook handling succeed in the target environment.
- Confirm quote PDFs download successfully and persist to S3 when configured.

## Helpful Database Commands

```bash
npm run db:reset
npm run db:seed
```

## Proxmox Test Environment

The repo includes a Proxmox-friendly Docker stack that runs the app on port `8585`.
The Proxmox project directory is expected at `/opt/docker/projects/azzure-autoquote-mvp`, and
`.env.proxmox` should live there.

Files to use:

- [`docker-compose.proxmox.yml`](/D:/Projects/azzure-autoquote-mvp-starter/azzure-autoquote-mvp/docker-compose.proxmox.yml)
- [`.env.proxmox.example`](/D:/Projects/azzure-autoquote-mvp-starter/azzure-autoquote-mvp/.env.proxmox.example)
- [`.github/workflows/ci.yml`](/D:/Projects/azzure-autoquote-mvp-starter/azzure-autoquote-mvp/.github/workflows/ci.yml)
- [`.github/workflows/proxmox-test-deploy.yml`](/D:/Projects/azzure-autoquote-mvp-starter/azzure-autoquote-mvp/.github/workflows/proxmox-test-deploy.yml)

Typical steps:

1. Copy `.env.proxmox.example` to `/opt/docker/projects/azzure-autoquote-mvp/.env.proxmox` on the Proxmox host.
2. Fill in the production-like secrets you want to test.
3. Run `cd /opt/docker/projects/azzure-autoquote-mvp && docker compose -f docker-compose.proxmox.yml up -d --build`.
4. Open `http://<proxmox-host>:8585`.
5. Check health at `http://<proxmox-host>:8585/api/health`.

GitHub Actions:

- `CI` validates migrations, seed, lint, typecheck, tests, and the production build.
- `Proxmox Test Deploy` runs on a self-hosted GitHub runner that lives on the Proxmox machine, builds the app locally, applies migrations, seeds the base plans, and restarts the stack.
- The self-hosted runner must have Docker and Docker Compose access, and the repository must allow that runner to pick up `develop` workflow jobs.
- The workflow syncs the repository into `/opt/docker/projects/azzure-autoquote-mvp` before running Docker Compose there.

## Current MVP Limitations

- Credentials auth is implemented first; SSO and magic links can be added later
- Uploaded images are converted to a data URL and are not persisted yet
- Overages are architected but disabled by default
- Email delivery and AWS deployment automation are still future phases
- AI visual estimates are approximate and not manufacturing specifications

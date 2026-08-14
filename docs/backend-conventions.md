# Backend Conventions

This repository currently uses a pragmatic backend layout centered on `lib/` helpers and route-local Prisma usage.

## Current structure

- `app/api/**` contains API route handlers.
- `app/**/page.tsx` contains server-rendered pages and a few route-driven data reads.
- `lib/` contains the bulk of backend logic today:
  - auth/session helpers
  - billing and usage helpers
  - Stripe webhook sync logic
  - quote number allocation
  - PDF generation
  - AI provider orchestration
- `src/components/ui/` contains shared UI primitives.
- `src/styles/design-tokens.css` contains the design tokens used by the frontend.

## Observed backend patterns

- Authentication is handled through `auth.ts` and company access through `lib/company.ts`.
- Most request validation is already done with Zod in route handlers.
- Prisma is still used directly from a number of API routes and helpers.
- Tenant scope is usually passed explicitly as `companyId`, but it is not yet centralized in a dedicated `src/services/*` layer.

## Prompt alignment status

- `src/services/*` does not exist yet.
- `src/lib/errors.ts` does not exist yet.
- `src/lib/logger.ts` did not exist before this pass; a root `lib/logger.ts` helper was added for webhook logging.
- The repo currently keeps the business logic in `lib/` rather than moving it into a new service layer.

## Working conventions to preserve

- Keep `companyId` explicit in service-style helpers.
- Validate route input with Zod before touching the database.
- Return safe client-facing messages from routes.
- Prefer `findFirst` with `companyId` over `findUnique` plus post-fetch ownership checks for tenant-scoped models.
- Avoid leaking raw Prisma errors or stack traces to the client.

## Deferred architecture work

- A formal `src/services/` split.
- A typed `AppError` hierarchy.
- Centralized route helpers for auth, validation, and error mapping.
- Shared public quote-link services and schema changes.

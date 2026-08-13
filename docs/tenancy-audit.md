# Tenancy Audit

Audit scope: tenant-scoped reads and writes that touch quote, analysis, subscription, usage, billing, or company membership data.

## Findings

| File | Query / Operation | Status | Notes |
| --- | --- | --- | --- |
| `app/api/analyze/route.ts` | `aiAnalysis.create`, `aiAnalysis.update`, `aiAttempt.create`, `usagePeriod.update` | PASS | `companyId` comes from the authenticated company context. Usage reservation is company-scoped. |
| `app/api/quotes/route.ts` | `aiAnalysis.findFirst({ id, companyId })`, `quote.create({ companyId })` | PASS | Analysis lookup is scoped to the active company before quote creation. |
| `app/api/quotes/[quoteId]/pdf/route.ts` | `quote.findFirst({ id, companyId })`, `quote.update({ id })` | PASS | Quote fetch is scoped to the active company. PDF storage key is derived from the quote record. |
| `app/api/billing/checkout/route.ts` | `subscription.upsert({ where: { companyId } })`, `usagePeriod.upsert({ companyId })` | PASS | Billing writes are tied to the active company. |
| `app/api/company/switch/route.ts` | Membership lookup via `isCompanyMember(context, companyId)` | PASS | Company selection is validated against the authenticated user’s memberships. |
| `lib/billing.ts` | `usagePeriod.findFirst({ companyId, periodStart, periodEnd })` | PASS | Usage period lookup is company-scoped. |
| `lib/usage.ts` | `usagePeriod` reservation/update by `companyId` or `usagePeriodId` | PASS | Reservation logic is company-scoped and uses row locking. |
| `lib/billing-webhooks.ts` | `subscription.findFirst(...)` | CONDITIONAL PASS | The lookup is now narrowed by `companyId` when Stripe metadata is available. If metadata is missing, the code falls back to Stripe IDs to recover existing subscriptions. |
| `app/q/[token]/page.tsx` | `quote.findUnique({ id: token })` | FAIL (by prompt standard) | This is a public route that currently uses the quote ID as the token. The prompt calls for a dedicated share token model and revocation flow, which is not implemented yet. |

## Non-tenant-scoped reads

These are global configuration reads and are not expected to be company-scoped:

- `lib/app-settings.ts`
- `lib/metal-pricing.ts`
- `lib/plan-bootstrap.ts`
- `lib/stripe.ts`
- `lib/internal-admin.ts`

## Remediations applied in this pass

- Hardened the Stripe webhook route to return `500` when the event handler fails, so Stripe can retry.
- Added structured JSON logging for webhook handler failures.
- Narrowed the Stripe subscription sync lookup in `lib/billing-webhooks.ts` when company metadata is present.

## Follow-up work still needed

- Split route-side business logic into a dedicated service layer.
- Add a real `SharedQuoteLink` model and token-based public quote resolver.
- Replace any remaining raw Prisma calls in route handlers with service functions.

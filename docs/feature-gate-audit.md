# Subscription Feature-Gate Audit

Audit date: 2026-08-14. Source of truth: `src/stripe/plans.ts`.

## Architecture

| Check | Result | Evidence / remediation |
|---|---|---|
| One feature matrix | PASS | The legacy `lib/subscription-plans.ts` now only re-exports `src/stripe/plans.ts`. |
| Company-aware assertion | PASS | `assertPlanFeature(companyId, feature)` loads the persisted subscription and fails closed for unknown plan IDs. |
| Trial mapping | PASS | `resolvePlanId` always maps `TRIALING` to `plan_professional`. |
| Locked UI primitive | PASS | `src/components/ui/PlanGate.tsx` accepts a typed `feature` and renders an upgrade card. |
| Ad-hoc server plan checks | PASS | Product enforcement paths use the feature matrix; remaining plan strings are selection, display, bootstrap, or admin filtering. |

## Feature findings

| Feature | UI | Server service / route | Regression coverage | Result |
|---|---|---|---|---|
| `aiPasses` | Starter does not advertise three passes | `/api/analyze` resolves `features.aiPasses` | Matrix and route wiring tests | PASS |
| `s3ImagePersistence` | Starter history is locked | `/api/analyze` skips S3 and does not persist a data URL for Starter | Matrix and route wiring tests | PASS |
| `canViewQuoteHistory` | Quote history renders `PlanGate` for Starter | History service asserts the feature and approved account | Static enforcement test | PASS |
| `canShareQuoteLink` | Share control remains visibly locked | `createShareLink` asserts the feature before lookup; API returns 403 on `PlanError` | Service/route/token tests | PASS |
| Public quote confidentiality | Only generated links work | Random 192-bit token; `/q/[token]` queries `publicShareToken`, never quote ID | Token wiring test | PASS |
| `canUseCustomPricingProfile` | No editable pricing-profile screen currently ships | Quote API ignores saved/posted overrides unless entitled; pricing write endpoint is closed | Quote route wiring test | PASS (enforcement) |
| `pdfBranding` | Starter logo input is locked; Professional/Enterprise allowed | PDF route resolves matrix branding; Starter watermark and Enterprise white label are generated server-side | PDF content test | PASS |
| `canPlaceManufacturingOrder` | Nested plan and CK locked states | `submitOrder` asserts Enterprise first, then approval/CK/finalized quote | Service wiring test | PASS |
| `maxSeats` | Seat limit and upgrade state derive from matrix | Team POST counts occupied memberships and returns 403 at limit | Endpoint wiring test | PASS |
| `overageEnabled` | Usage display continues beyond limit for eligible plans | Starter/trials hard-cap; paid Professional/Enterprise reserve overage; Stripe meter event is required and idempotently identified | Usage/meter wiring tests | PASS |
| `canCreateQuotes` | Quote builder remains role-aware | Analyze and quote POST require active billing, approved account, pricing tier, and feature | Route wiring test | PASS |

## Gate mapping

| Feature | Locked UI | Service gate | API gate / error mapping | Result |
|---|---|---|---|---|
| Quote history | `PlanGate(canViewQuoteHistory)` | `getQuoteHistoryPage` | Quote GET uses `assertPlanFeature` | PASS |
| Share links | Disabled upgrade state | `createShareLink` | `POST /api/quotes/[quoteId]/share` maps `PlanError` to 403 | PASS |
| Manufacturing | `PlanGate(canPlaceManufacturingOrder)` plus CK state | `submitOrder` | `POST /api/orders` maps `PlanError` to 403 | PASS |
| Team seats | Limit card | Membership count checked before user creation | Team POST maps `PlanError` to 403 | PASS |
| Branding | Locked logo field | Matrix branding selected in PDF route | Branding POST rejects Starter logo | PASS |

## Cross-cutting findings

### Approval and tier

Quote analysis and creation reject `PENDING_APPROVAL`, `SUSPENDED`, and approved companies without a tier. Quote reads use an approved-company service assertion. Manufacturing additionally requires CK verification. PASS.

### Trial behavior

Trials use Professional features regardless of the selected future plan, cannot share or manufacture, use the separate trial usage period/cap, and increment `trialQuotesUsed` when analysis succeeds. PASS.

### Past-due and canceled behavior

`assertBillableSubscription` blocks new analysis/quote creation for `PAST_DUE` and `CANCELED`. Existing approved-company quote reads do not require a billable status. PASS.

### Tier snapshots

New quote creation requires a tier and writes making price, tier, divisor, and selling price together. A backfill command exists for historical records: `npm run db:backfill-selling-price`. Database verification remains a deployment check.

```sql
SELECT id, "companyId", "makingPrice", "pricingTierSnapshot", "estimatedSellingPrice"
FROM "Quote"
WHERE "makingPrice" IS NOT NULL
  AND ("pricingTierSnapshot" IS NULL OR "estimatedSellingPrice" IS NULL);
```

Expected result: zero rows.

### Stripe mapping and overage configuration

Checkout sessions now write both `planId` and `planCode`; webhooks prefer exact `planId` metadata and throw for unknown IDs. Legacy subscriptions can still resolve by mapped Price/Product IDs during migration.

Production must define `STRIPE_QUOTE_OVERAGE_METER_EVENT_NAME`. An eligible overage fails closed if the meter name or Stripe customer is missing, preventing unbilled overage usage.

## Verification

Automated coverage is in `test/feature-gates.test.ts`, `test/pdf.test.ts`, `test/usage.test.ts`, and the existing integration/security suites. The production database query, live S3 behavior, and Stripe test-mode meter delivery must be run after deployment because they require deployment credentials and services.

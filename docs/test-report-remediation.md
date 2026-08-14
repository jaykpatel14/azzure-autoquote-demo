# Staging Test Report Remediation

Date: 2026-08-14

| Finding | Resolution | Status |
|---|---|---|
| `/quotes` and `/quotes/[id]` crash for approved tenant without tier | Added route guards, proxy enforcement, a friendly `/configuration` state, and a data repair migration | FIXED |
| Legacy quote has selling price but no making/tier snapshots | Migration reconstructs making price from the preserved customer total and assigned divisor; backfill command now handles this legacy shape | FIXED |
| Manufacturing requires Enterprise | Retained intentionally: the approved subscription source of truth defines `canPlaceManufacturingOrder` as Enterprise-only. CK verification is an additional requirement, not a replacement entitlement. | PRODUCT DECISION |
| Logged-out `/` shows marketing | Retained intentionally: `/` is the public acquisition surface and exposes no tenant data; authenticated users receive the dashboard. | PRODUCT DECISION |
| Dashboard “Value” label | Renamed to “Quote price” | FIXED |
| Builder “Approved final price” label | Renamed to “Quote price” | FIXED |
| Health response differs from documented contract | Added `status: "ok"` while preserving existing health fields for compatibility; failure no longer exposes database errors | FIXED |
| Invalid quote token uses generic 404 | Added a branded segment-level not-found page | FIXED |
| Admin auth activity incorrectly names a tenant | Admin session events no longer append or link to the tenant | FIXED |
| Metals.dev and S3 degraded | Deployment configuration; set the Metals.dev credential and S3 variables in the staging container | ENVIRONMENT |
| Billing omits pricing tier | Added the assigned tier name without exposing formula/divisor | FIXED |

## Deployment requirements

Run `npx prisma migrate deploy` before restarting the application. Then run `npm run db:backfill-selling-price` as a verification/repair pass. The migration is designed to be safe for already-correct rows.

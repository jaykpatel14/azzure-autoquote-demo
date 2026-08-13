# Backend Prompt Checklist

Status legend:
- `[x]` done in the current repo
- `[~]` partially done or implemented with caveats
- `[ ]` not done yet

## Phase 1 - Local Foundation

- [x] Verify Next.js, TypeScript strict mode, Prisma, PostgreSQL, and Docker Compose.
- [x] Ensure `.env.example` documents every variable without secrets.
- [x] Create and validate Prisma migrations.
- [x] Add a deterministic seed for plans, a demo company, owner user, subscription, usage period, and pricing profile.
- [~] Replace fragile quote numbering based on count with a concurrency-safe strategy.
- [x] Add Vitest unit tests for metal density conversion, price calculation, median aggregation, and confidence aggregation.
- [x] Add integration tests for quote creation and tenant isolation.
- [x] Add scripts for test, typecheck, lint, build, database reset, and seed.
- [x] Update README with Windows/WSL, macOS, and Linux instructions.

## Phase 2 - Authentication and Multi-Tenancy

- [x] Use Auth.js with secure session cookies.
- [x] Support email/password initially, with room for magic-link or SSO later.
- [x] Add sign-up, sign-in, sign-out, forgot-password, reset-password, and email-verification flows.
- [x] On onboarding, create a company and OWNER membership transactionally.
- [~] Add OWNER, ADMIN, ESTIMATOR, and VIEWER authorization.
- [x] Remove `DEFAULT_COMPANY_ID`.
- [x] Derive company context from the authenticated membership.
- [x] Add a company switcher for users belonging to multiple companies.
- [x] Enforce `companyId` in every server query, action, and route.
- [x] Add tests proving one company cannot read or modify another company's data.
- [x] Add an audit log for security-sensitive actions.

## Phase 3 - AI Jewelry Analysis

- [x] Use the OpenAI Responses API server-side.
- [x] Set `store: false` unless product policy explicitly changes.
- [x] Accept JPG, PNG, and WEBP only, maximum 8 MB.
- [x] Run image moderation before analysis.
- [x] Make three independent review calls.
- [x] Require structured output matching a Zod schema.
- [x] Aggregate numeric values by median.
- [x] Record each attempt separately with model, latency, token usage when available, output, and errors.
- [x] Add retry logic only for transient errors and never charge an extra customer unit for automatic retries.
- [x] Add a provider adapter so another AI model can be added later.
- [x] Store prompt versions and model versions.
- [x] Add evaluation fixtures using representative jewelry images supplied by the product owner.
- [x] Never present the estimate as exact.

## Phase 4 - Stripe Billing and Usage

- [x] Stripe Checkout for subscription purchase.
- [x] Stripe Customer Portal for billing management.
- [x] Idempotent webhook handling.
- [x] Store Stripe customer, subscription, product, price, status, and billing period.
- [x] Restrict AI analysis to active or trialing subscriptions.
- [x] Atomically reserve one estimate before processing.
- [x] On success: reserved -1 and used +1.
- [x] On failure: reserved -1, used unchanged.
- [x] Three AI calls count as one customer estimate.
- [~] Add plan upgrade/downgrade behavior.
- [x] Add usage dashboard and near-limit warnings.
- [x] Add optional overage architecture but keep overages disabled initially.
- [x] Test duplicate webhooks, concurrent requests at the final quota unit, failed analysis, cancellation, and past-due states.

## Phase 5 - AWS Production

- [ ] Create infrastructure-as-code using Terraform.
- [ ] Use separate naming, security groups, IAM roles, buckets, repositories, and databases.
- [ ] RDS must not be publicly accessible.
- [ ] EC2 should use an IAM role, not static AWS keys.
- [ ] S3 files must be private and accessed with short-lived presigned URLs.
- [ ] Create least-privilege IAM policies.
- [ ] Configure health checks, log rotation, backups, alarms, and budget alerts.
- [ ] Add a GitHub Actions pipeline for test, lint, typecheck, build, Docker build, image scan, ECR push, deploy, safe migrations, health verification, and rollback.
- [ ] Document DNS and TLS configuration.
- [ ] Document backup restoration and rollback.
- [ ] Do not change or reuse resources belonging to another website.

## Phase 6 - Security and QA

- [~] Tenant isolation review.
- [~] Authentication and authorization review.
- [x] CSRF protection.
- [x] Rate limiting.
- [x] Upload validation.
- [~] Private storage.
- [x] Secret handling.
- [~] Dependency audit.
- [x] Secure headers.
- [x] Stripe webhook signature verification.
- [x] SQL injection and XSS protection.
- [x] Audit logs.
- [ ] Data retention and deletion.
- [~] OpenAI data-control settings.
- [x] Unit tests.
- [x] Integration tests.
- [ ] End-to-end tests.
- [~] Concurrency tests.
- [x] Billing webhook tests.
- [x] Quota boundary tests.
- [x] Tenant isolation tests.
- [~] Failed third-party service tests.
- [ ] Database backup restoration test.
- [ ] Production smoke tests.
- [ ] Findings ranked Critical, High, Medium, Low.
- [ ] Fixes for Critical and High findings.
- [ ] Automated tests preventing regressions.
- [ ] Release checklist.
- [ ] Go/no-go recommendation supported by evidence.

## Phase 7 - UI and UX

- [x] Onboarding.
- [x] Dashboard.
- [x] New estimate flow.
- [x] Image upload progress.
- [x] AI processing states.
- [x] Editable estimate form.
- [x] Quote preview.
- [x] Quote history.
- [~] Customers.
- [x] Pricing settings.
- [x] Team management.
- [x] Usage and billing.
- [x] Admin support screens.
- [x] Responsive layout.
- [x] Accessible keyboard navigation.
- [x] Clear loading, error, and empty states.
- [x] WCAG-aware contrast.
- [x] No exposure of internal margin or cost fields to customer-facing quote recipients.
- [x] Customer quote shows only the approved estimated final price.
- [x] Final-price disclaimer.
- [x] Confirmation before destructive actions.

## Current Focus

- [x] Turn the prompt into a tracked checklist.
- [ ] Work through the remaining backend gaps one by one.

## Notes

- This checklist reflects the current repository state as inspected in August 2026.
- Items marked `[~]` should be re-reviewed during the next implementation pass before being promoted to `[x]`.

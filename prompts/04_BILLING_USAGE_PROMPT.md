# Phase 4 — Stripe Billing and Usage Prompt

Implement subscription billing and monthly usage enforcement.

Plans:
- Professional: $99/month, 500 estimates
- Enterprise: configurable

Requirements:
1. Stripe Checkout for subscription purchase.
2. Stripe Customer Portal for billing management.
3. Idempotent webhook handling.
4. Store Stripe customer, subscription, product, price, status, and billing period.
5. Restrict AI analysis to active or trialing subscriptions.
6. Atomically reserve one estimate before processing.
7. On success: reserved -1 and used +1.
8. On failure: reserved -1, used unchanged.
9. Three AI calls count as one customer estimate.
10. Add plan upgrade/downgrade behavior.
11. Add usage dashboard and near-limit warnings.
12. Add optional overage architecture but keep overages disabled initially.
13. Test duplicate webhooks, concurrent requests at the final quota unit, failed analysis, cancellation, and past-due states.

Never trust subscription status returned by the browser.

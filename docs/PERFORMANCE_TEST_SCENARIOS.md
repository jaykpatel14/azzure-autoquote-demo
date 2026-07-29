# Performance Test Scenarios

Use this checklist to verify the application under normal and failure conditions.

## Test Accounts

- Customer demo: `test@acme.com` / `demo-password`
- Demo owner: `owner@demojewelry.test` / `demo-password`
- Internal admin: `admin@azzure.com` / `password123`

## Suggested Timing Targets

- Page navigation: under 2 seconds on a local or Proxmox test stack
- Quote analysis request: under 10 seconds with a normal image
- Quote save request: under 2 seconds after analysis completes
- PDF generation: under 5 seconds
- Admin pages: under 3 seconds for a company with moderate data

## How to Run

1. Start the app.
2. Sign in with the account that matches the scenario.
3. Keep DevTools open on the Network tab for timing and error inspection.
4. Repeat the same flow with both a normal network and a throttled network.
5. Record the result as `pass`, `fail`, or `slow`.

## Customer-Facing Scenarios

### 1. Sign in

- Positive:
  - Sign in successfully with `test@acme.com`.
  - Confirm the workspace opens without errors.
  - Confirm the page shows company-specific data.
- Negative:
  - Sign in with an invalid password.
  - Sign in with an unknown email.
  - Refresh after signing out and confirm protected pages redirect.
- Performance:
  - Sign-in redirect should feel immediate and not hang on a blank page.

### 2. Workspace dashboard

- Positive:
  - Load the main workspace dashboard.
  - Confirm navigation shows only customer-facing items.
  - Confirm live pricing, quote history, and subscription billing are visible.
- Negative:
  - Try loading the page with no company membership.
  - Try loading it after removing the active company cookie.
  - Confirm unauthorized access redirects to sign-in or shows an access error.
- Performance:
  - Dashboard should load in under 2 seconds with recent quote data.

### 3. New estimate flow

- Positive:
  - Open `New estimate`.
  - Upload a valid JPG, PNG, or WEBP image.
  - Wait for analysis to complete.
  - Confirm the form becomes editable.
  - Confirm the customer can edit metal, stone, and customer name fields.
- Negative:
  - Upload an unsupported file type.
  - Upload a file larger than the allowed limit.
  - Start analysis with no file selected.
  - Cancel or interrupt the request and confirm the UI shows a useful error.
- Performance:
  - Upload progress should move continuously.
  - The analysis request should not freeze the UI.
  - The draft should become editable immediately after the analysis response.

### 4. Quote save

- Positive:
  - Edit the analyzed values.
  - Save the draft manually.
  - Confirm a quote number is returned.
  - Confirm the PDF download link appears after save.
- Negative:
  - Try saving with the network offline.
  - Try saving with invalid numeric values.
  - Try saving the same draft twice in quick succession.
  - Confirm duplicate save attempts do not crash the page.
- Performance:
  - Save should complete in under 2 seconds after the analysis result is ready.

### 5. Quote history

- Positive:
  - Open quote history.
  - Confirm recent quotes are listed.
  - Open a quote detail from history.
  - Download the PDF.
- Negative:
  - View an account with no quotes yet.
  - Open a missing or tampered quote id.
  - Confirm the app shows a not-found or access response.
- Performance:
  - History should load quickly even with a moderate number of saved quotes.

### 6. Subscription billing

- Positive:
  - Open subscription billing.
  - Confirm the plan, status, and usage meter render.
  - Confirm the Stripe portal button is enabled only when a Stripe customer exists.
- Negative:
  - Open billing with no active subscription.
  - Open billing with no usage period.
  - Confirm the UI explains the missing data without breaking.
- Performance:
  - Billing page should render in under 2 seconds.

### 7. Live pricing display

- Positive:
  - Confirm live pricing cards show current values.
  - Confirm the source label reflects live feed or fallback.
- Negative:
  - Disable `METALS_DEV_API_KEY` in the environment and reload.
  - Break the Metals.dev request and confirm the app falls back cleanly.
  - Confirm the UI still works if live pricing cannot be fetched.
- Performance:
  - Pricing data should not block the whole page for a long time.

## Internal Admin Scenarios

### 8. Internal admin access

- Positive:
  - Sign in with `admin@azzure.com`.
  - Confirm the app redirects to `/admin`.
  - Confirm the internal shell and navigation render.
- Negative:
  - Sign in with a non-admin account and open `/admin`.
  - Confirm the app blocks access.
- Performance:
  - Admin shell should load in under 2 seconds.

### 9. Admin overview

- Positive:
  - Open `/admin`.
  - Confirm company counts, subscription counts, and webhook issues render.
  - Open a recent company from the list.
- Negative:
  - Load the page when there are no failed webhooks.
  - Load it when there are many companies.
  - Confirm the page remains usable.
- Performance:
  - The overview should still feel responsive with a larger company list.

### 10. Admin companies list

- Positive:
  - Open `/admin/companies`.
  - Confirm the table lists company, billing, quotes, members, and last quote.
  - Open a company detail page.
- Negative:
  - Open the page with zero companies.
  - Open with a company missing a subscription or quote history.
- Performance:
  - The list should sort and render without visible lag.

### 11. Admin billing editor

- Positive:
  - Open `/admin/billing`.
  - Open a company billing editor.
  - Edit company name, slug, logo, subscription status, Stripe identifiers, and plan.
  - Save and confirm the page redirects back to the edited company.
- Negative:
  - Submit an invalid date range.
  - Submit blank company name.
  - Submit an invalid Stripe id string.
  - Try editing live pricing fields and confirm they are not present.
- Performance:
  - Saving should complete without a long pause.

### 12. Admin settings

- Positive:
  - Open `/admin/settings`.
  - Confirm only allowed runtime settings are shown.
  - Update a secret key and confirm the value is masked afterward.
- Negative:
  - Confirm Metals.dev cache keys are not editable from this screen.
  - Try submitting an unsupported key and confirm the server rejects it.
- Performance:
  - The page should render even when runtime settings are empty.

### 13. Admin company detail

- Positive:
  - Open a single company.
  - Review members, quotes, audit logs, and billing context.
  - Add a member with a valid email and role.
- Negative:
  - Add a member with a duplicate email already in the company.
  - Add a member with a missing password for a brand new user.
  - Open a missing company id.
- Performance:
  - Detail page should remain responsive with recent history visible.

## Billing and Stripe Scenarios

### 14. Checkout

- Positive:
  - Start a checkout for a billable plan.
  - Confirm the redirect to Stripe happens.
  - Confirm success sync updates the subscription after return.
- Negative:
  - Submit checkout without a Stripe price id.
  - Try checkout with a stale or missing session id.
  - Confirm the app shows a useful error.

### 15. Billing portal

- Positive:
  - Open the billing portal when a Stripe customer exists.
  - Confirm the portal opens.
- Negative:
  - Open the portal with no Stripe customer id.
  - Confirm the action is disabled or fails gracefully.

### 16. Stripe webhook processing

- Positive:
  - Process a checkout.session.completed event.
  - Process a customer.subscription.updated event.
  - Confirm subscription and usage period sync correctly.
- Negative:
  - Send a malformed event.
  - Send the same event twice.
  - Confirm duplicate events are ignored and invalid payloads are rejected.
- Performance:
  - Webhook handling should finish quickly and not block the UI.

## PDF and Quote Output Scenarios

### 17. Quote PDF

- Positive:
  - Generate a PDF for a saved quote.
  - Confirm it stays on one page.
  - Confirm company/customer name, quote number, and analysis photo appear.
- Negative:
  - Generate a PDF without an uploaded image.
  - Generate a PDF for a quote missing customer name.
  - Confirm it still renders cleanly.
- Performance:
  - PDF generation should not take long enough to feel stuck.

### 18. Quote number stability

- Positive:
  - Save multiple quotes in sequence.
  - Confirm quote numbers increment in order.
- Negative:
  - Simulate a stale quote sequence.
  - Retry save after a collision and confirm it still succeeds.

## Error and Resilience Scenarios

### 19. Live pricing fallback

- Positive:
  - Turn on the Metals.dev API key and confirm live feed data appears.
- Negative:
  - Remove the Metals.dev API key.
  - Break the Metals.dev endpoint.
  - Confirm the app uses fallback pricing instead of failing.

### 20. Database and connectivity

- Positive:
  - Start the app with a healthy database.
  - Confirm the health endpoint returns success.
- Negative:
  - Stop the database container.
  - Refresh the app and confirm the error is understandable.
  - Restart the database and confirm the app recovers.

### 21. Unauthorized access

- Positive:
  - Access a permitted page with a valid role.
- Negative:
  - Attempt to open admin pages as a customer user.
  - Attempt to open company pages for another tenant.
  - Confirm the app blocks access and does not leak data.

## Quick Load Test Ideas

- Open the dashboard, quote history, billing, and admin pages in separate tabs.
- Upload 5 to 10 images back to back and confirm the UI recovers after each analysis.
- Save 10 quotes in a row and verify quote numbers stay unique.
- Open the billing editor for multiple companies and confirm the forms stay responsive.
- Run the app once with live pricing enabled and once with it disabled to verify fallback behavior.

## Result Log

Use this simple format when recording your results:

- Scenario:
- Environment:
- Positive result:
- Negative result:
- Performance:
- Notes:


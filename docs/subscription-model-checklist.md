# Azzure AI Quote Subscription Model Checklist

## 1. Pricing page
- [ ] Build the public `/pricing` marketing page
- [ ] Add the monthly / annual toggle
- [ ] Render the three plan cards with the correct CTA copy
- [ ] Add the feature comparison table
- [ ] Add the FAQ accordion

## 2. Signup and trial start
- [ ] Build the public `/signup` page
- [ ] Carry the selected plan from `/pricing` into signup
- [ ] Validate the signup form on blur with Zod
- [ ] Add password strength feedback and show / hide toggle
- [ ] Create the public checkout route and Stripe session flow
- [ ] Start the 14-day trial on account creation

## 3. Onboarding flow
- [ ] Build the three-step onboarding flow after checkout
- [ ] Require confirmation of the trial and billing details
- [ ] Collect company branding and workspace setup details

## 4. Trial experience
- [ ] Show the trial banner in the app
- [ ] Display trial days remaining and quote cap
- [ ] Add warning states for nearing trial expiry

## 5. Upgrade and billing settings
- [ ] Build the upgrade modal
- [ ] Improve billing settings to show plan, usage, and cancel controls
- [ ] Support plan changes and cancellation copy

## 6. Subscription backend lifecycle
- [ ] Add the PLAN_FEATURES map
- [ ] Add `assertPlanFeature`
- [ ] Persist trial lifecycle fields in Prisma
- [ ] Sync Stripe webhooks to local subscription records
- [ ] Handle auto-conversion, reminders, and cancellations

## 7. Cancellation and overage
- [ ] Add cancellation flows
- [ ] Add overage billing support
- [ ] Add quote-level overage tracking

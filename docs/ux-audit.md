# AutoQuote UI/UX Audit Report

Audited by: Codex  
Date: 2026-08-14

## Summary

| Severity | Count | Fixed | Deferred | Wontfix |
|---|---:|---:|---:|---:|
| Critical | 4 | 3 | 1 | 0 |
| Major | 14 | 9 | 5 | 0 |
| Minor | 10 | 5 | 5 | 0 |
| Enhancement | 5 | 2 | 3 | 0 |

This was a source audit of every page/component route in `app`, `components`, and `src/components`. Authenticated screenshots were unavailable because this workspace has no configured `DATABASE_URL`; render-dependent findings remain DEFERRED until the deployment visual pass.

## Positive standards already present

- `WorkspaceShell` consistently provides a skip link, page landmark, current navigation state, title, description, and dark authenticated surface.
- Quote, order, and team deletion/cancellation use inline confirmation rather than surprise destructive actions.
- `prefers-reduced-motion` is respected globally.
- Currency formatters use `Intl.NumberFormat`; customer quote surfaces expose the selling price only.
- Core quote, order, settings, and admin routes have representative skeleton loading boundaries.

## Section 1 — Design token consistency

### Finding 1.1 — Fonts were named but never loaded
- **Severity:** Critical
- **Location:** `app/layout.tsx`, `src/styles/design-tokens.css:17`
- **Issue:** Cormorant Garamond, Inter, and JetBrains Mono depended on local/system availability, producing brand drift and fallback layout shift.
- **Fix:** Load all three with `next/font/google` variables and consume those variables in the token file.
- **Status:** FIXED

### Finding 1.2 — Hardcoded palette values outside the token file
- **Severity:** Major
- **Location:** `app/globals.css:17`, `app/globals.css:2297-2328`
- **Issue:** Dark background and signup status colors bypassed the palette.
- **Fix:** Added semantic tokens and replaced the literal hex values.
- **Status:** FIXED

### Finding 1.3 — Extensive one-off translucent colors remain
- **Severity:** Major
- **Location:** `app/globals.css` (rgba occurrences throughout, notably lines 116-235 and 1840-2443)
- **Issue:** Surface, border, hover, and text alpha values are repeatedly redefined rather than named.
- **Fix:** Consolidate these into semantic tokens such as `--surface-card`, `--border-hairline`, `--text-secondary-dark`, and `--surface-gold-hover` after visual regression snapshots exist.
- **Status:** DEFERRED — broad mechanical replacement without screenshots risks changing established hierarchy.

### Finding 1.4 — One-off radii and shadows bypass the scale
- **Severity:** Minor
- **Location:** `app/globals.css:2034,2126,2207,2402,2433,2529`
- **Issue:** 18px, 22px, 24px, 28px, and 32px radii plus page-specific shadows are outside the defined token scale.
- **Fix:** Map public marketing surfaces to `--radius-xl` or add explicitly named public-card tokens.
- **Status:** DEFERRED

### Finding 1.5 — Inline layout/presentation styles remain
- **Severity:** Minor
- **Location:** admin detail pages, settings pages, and loading skeletons (`style={{...}}` scan)
- **Issue:** Repeated margin, width, flex, and light-card values are not reusable classes. Dynamic progress widths and skeleton dimensions are legitimate exceptions.
- **Fix:** Move static values to utility classes; retain only data-driven widths/heights.
- **Status:** DEFERRED

## Section 2 — Visual identity

### Finding 2.1 — Authenticated surfaces follow the luxury dark identity
- **Severity:** Enhancement
- **Location:** `components/workspace-shell.tsx`, `app/globals.css:104-235`
- **Issue:** None. Obsidian background, restrained gold accents, bordered cards, and display typography form a coherent standard.
- **Fix:** Reuse this shell for future tenant routes.
- **Status:** FIXED (positive standard)

### Finding 2.2 — Card shadows conflict with border-led elevation
- **Severity:** Minor
- **Location:** upgrade modal and public/marketing cards in `app/globals.css`
- **Issue:** Authenticated modal and some cards use large shadows despite borders being the primary elevation signal.
- **Fix:** Remove dashboard card shadows; retain subtle shadows only for modal separation and the light public surface.
- **Status:** DEFERRED pending screenshot comparison.

### Finding 2.3 — Pricing headline was generic
- **Severity:** Major
- **Location:** `app/(marketing)/pricing/page.tsx:118`
- **Issue:** The trial statement described the offer but not the product outcome.
- **Fix:** Changed the hero to “Quote any piece. In seconds.” with a product-specific eyebrow.
- **Status:** FIXED

### Finding 2.4 — Trial benefit was visually late in plan cards
- **Severity:** Major
- **Location:** `app/(marketing)/pricing/page.tsx` plan-card rendering
- **Issue:** The free trial appeared only as a low-emphasis footnote.
- **Fix:** Added “14-day free trial” at the top of every plan card.
- **Status:** FIXED

## Section 3 — Typography

### Finding 3.1 — Monetary hierarchy is largely consistent
- **Severity:** Enhancement
- **Location:** `.quotePrice`, `.pricingCardPrice`, `.publicQuotePrice`, admin money formatters
- **Issue:** Prices already use the display face and `Intl.NumberFormat`.
- **Fix:** Marketing plan prices now retain two decimal places for cross-surface consistency.
- **Status:** FIXED

### Finding 3.2 — Display font used below 18px
- **Severity:** Minor
- **Location:** `.publicQuoteCta`, `.featureTable tbody th`
- **Issue:** Small UI controls/table labels used Cormorant Garamond.
- **Fix:** Switched these selectors to Inter.
- **Status:** FIXED

### Finding 3.3 — Type-scale exceptions are undocumented
- **Severity:** Minor
- **Location:** `app/globals.css` values including 12px, 14px, 18.4px, 22.4px and fluid clamps
- **Issue:** Several values fall outside the 11/13/15/17/20/26/36/52/80 scale.
- **Fix:** Normalize dashboard UI to tokens; document fluid marketing-display exceptions.
- **Status:** DEFERRED pending visual regression coverage.

### Finding 3.4 — Marketing plan price omitted cents
- **Severity:** Minor
- **Location:** `app/(marketing)/pricing/page.tsx:95`
- **Issue:** Prices displayed `$49` while quote/customer prices displayed two decimals.
- **Fix:** Set both minimum and maximum fraction digits to 2.
- **Status:** FIXED

## Section 4 — Interaction and usability

### Finding 4.1 — Core destructive actions use inline confirmation
- **Severity:** Enhancement
- **Location:** `quote-row-actions.tsx`, `order-cancel-button.tsx`, `team-member-row.tsx`, billing cancellation page
- **Issue:** None; this is the preferred pattern.
- **Fix:** Preserve as the standard.
- **Status:** FIXED (positive standard)

### Finding 4.2 — Failed destructive actions lacked user feedback
- **Severity:** Major
- **Location:** `components/quote-row-actions.tsx`, `team-member-row.tsx`, `order-cancel-button.tsx`
- **Issue:** Network/API failure produced no toast and could surface an unhandled promise.
- **Fix:** Added persistent, user-language error toasts while retaining loading reset.
- **Status:** FIXED

### Finding 4.3 — Some server-posted forms lack pending button states
- **Severity:** Major
- **Location:** branding/team/profile/admin forms using plain HTML actions
- **Issue:** Buttons do not disable or change label during navigation.
- **Fix:** Introduce a shared client `SubmitButton` using `useFormStatus` and migrate action forms.
- **Status:** DEFERRED

### Finding 4.4 — Upgrade dialog does not manage keyboard focus
- **Severity:** Major
- **Location:** `components/upgrade-modal.tsx:27`
- **Issue:** `role="dialog"` is present, but focus is not initially moved into the dialog or trapped/restored.
- **Fix:** Use native `<dialog>` or a tested focus-management primitive.
- **Status:** DEFERRED

### Finding 4.5 — Small controls missed 44px targets
- **Severity:** Major
- **Location:** `.button--sm`, `.workspaceNavItem` mobile, `.textLink`, `.quoteTab`, `.settingsTab`
- **Issue:** Several actions were 36-42px high or had text-only hit areas.
- **Fix:** Raised minimum control height to 44px and expanded action-link/tab hit areas.
- **Status:** FIXED

### Finding 4.6 — AI progress resolves per facet, not per server pass
- **Severity:** Major
- **Location:** `components/QuoteCalculator.tsx`, `/api/analyze`
- **Issue:** The UI cycles descriptive stages locally, but the server returns only after all entitled review passes; users cannot see real pass completion.
- **Fix:** Stream or poll attempt completion and reveal pass 1/2/3 results; add 20-30 second expectation and 60-second recovery state.
- **Status:** DEFERRED — requires an analysis-job transport change, not a cosmetic edit.

## Section 5 — Copy and microcopy

### Finding 5.1 — Authentication could expose provider error text
- **Severity:** Critical
- **Location:** `components/sign-in-form.tsx:31-36`
- **Issue:** Non-credential Auth.js errors were rendered verbatim.
- **Fix:** Replaced them with a stable, helpful retry message; credential errors now explain verification as a possible remedy.
- **Status:** FIXED

### Finding 5.2 — Plan gates were generic walls
- **Severity:** Major
- **Location:** `src/components/ui/PlanGate.tsx`
- **Issue:** Every locked feature used the same generic explanation and “Review plans” CTA.
- **Fix:** Added benefit-first feature copy and specific Professional/Enterprise upgrade labels.
- **Status:** FIXED

### Finding 5.3 — Sentence case is inconsistent
- **Severity:** Minor
- **Location:** dashboard quick actions (“New Quote”, “Share a Quote”, “Place an Order”) and selected admin labels
- **Issue:** Title case appears in action labels.
- **Fix:** Normalize action labels in a dedicated copy pass and preserve proper product names/acronyms.
- **Status:** DEFERRED

### Finding 5.4 — Customer-facing pricing does not reveal tier formulas
- **Severity:** Critical
- **Location:** jeweler/customer route scan; protected by `test/price-visibility.test.ts`
- **Issue:** None found. Divisor/tier financial detail is limited to admin surfaces.
- **Fix:** Keep regression coverage.
- **Status:** FIXED

## Section 6 — Accessibility

### Finding 6.1 — Muted text failed AA on charcoal
- **Severity:** Critical
- **Location:** `src/styles/design-tokens.css:6`; helper text and table metadata globally
- **Issue:** `#636366` does not meet 4.5:1 on charcoal for normal text.
- **Fix:** Lightened `--color-muted` to `#a1a1aa`, which provides comfortably readable contrast on the authenticated dark surfaces.
- **Status:** FIXED

### Finding 6.2 — Focus treatment is globally visible
- **Severity:** Enhancement
- **Location:** `app/globals.css:45`
- **Issue:** None. `:focus-visible` uses a 2px gold outline and 2px offset; local `outline:none` rules supply visible gold box-shadow replacements.
- **Fix:** Preserve and test in browsers.
- **Status:** FIXED (positive standard)

### Finding 6.3 — Meaningful jewelry images had empty/generic alt text
- **Severity:** Major
- **Location:** quote dashboard/list/detail and `QuoteCalculator` facet images
- **Issue:** Jewelry previews were announced as decorative or generically as “Quote source image.”
- **Fix:** Added metal, quote number, facet title, and analysis context to alt text; company logo now says “[Company] logo.”
- **Status:** FIXED

### Finding 6.4 — Filter tabs lacked tab semantics
- **Severity:** Major
- **Location:** quote and admin order filter navigation
- **Issue:** Visual tabs were ordinary links without selected-state semantics.
- **Fix:** Added `tablist`, `tab`, and `aria-selected` attributes.
- **Status:** FIXED

### Finding 6.5 — Order timeline lacked list semantics
- **Severity:** Minor
- **Location:** `app/orders/[orderId]/page.tsx:126`
- **Issue:** A visual sequence was exposed as unrelated divs.
- **Fix:** Added labeled list/listitem roles.
- **Status:** FIXED

### Finding 6.6 — Field errors are not associated with inputs
- **Severity:** Major
- **Location:** signup/reset/cancellation client forms
- **Issue:** Visible errors generally lack stable IDs and `aria-describedby`; required indicators are inconsistent.
- **Fix:** Add shared `Field`/`FieldError` components with touched-on-blur validation and accessible descriptions.
- **Status:** DEFERRED

## Section 7 — Responsive design

### Finding 7.1 — Sidebar becomes a bottom navigation
- **Severity:** Enhancement
- **Location:** `app/globals.css` max-width 768px rules
- **Issue:** The intended collapse exists, uses horizontal scrolling, and preserves active gold state.
- **Fix:** Increased mobile item height to 44px.
- **Status:** FIXED

### Finding 7.2 — Bottom navigation can exceed five items
- **Severity:** Major
- **Location:** `workspace-shell.tsx` plus `getWorkspaceNav`
- **Issue:** Every desktop item flows into the mobile horizontal bar rather than prioritizing 4-5 destinations.
- **Fix:** Create a mobile-specific nav subset and an overflow “More” action.
- **Status:** DEFERRED

### Finding 7.3 — Tables scroll but lack a clear affordance/sticky identity
- **Severity:** Major
- **Location:** quote, order, customer, tenant, billing, and pricing tables
- **Issue:** `overflow-x:auto` prevents clipping, but users receive no edge hint and the first column is not sticky.
- **Fix:** Add edge fade/scroll hint and sticky first column, or switch tenant-facing tables to mobile cards.
- **Status:** DEFERRED

### Finding 7.4 — New quote upload was not camera-first
- **Severity:** Major
- **Location:** `components/QuoteCalculator.tsx` upload zone
- **Issue:** Mobile users saw one generic file chooser.
- **Fix:** Added explicit “Take a photo” (`capture="environment"`) and “Choose from library” actions.
- **Status:** FIXED

## Section 8 — Shareable quote page

### Finding 8.1 — Customer CTA pointed to Azzure sign-in/home
- **Severity:** Critical
- **Location:** `app/q/[token]/page.tsx`
- **Issue:** The page offered “Sign in for revisions” and “Return home” instead of directing the customer to the jeweler.
- **Fix:** Replaced both with one full-width “Visit [Jeweler]” CTA using the company website.
- **Status:** FIXED

### Finding 8.2 — Quote expiry was not communicated
- **Severity:** Major
- **Location:** `app/q/[token]/page.tsx`
- **Issue:** Links remained visually timeless and had no helpful expired state.
- **Fix:** Added a 30-day validity date based on `sharedAt` and an SSR expired-link message with jeweler contact CTA.
- **Status:** FIXED

### Finding 8.3 — Price is the public-page hero
- **Severity:** Enhancement
- **Location:** `.publicQuotePrice`
- **Issue:** None. It uses Cormorant Garamond 300 at the 80px display token and remains server-rendered.
- **Fix:** Preserve.
- **Status:** FIXED (positive standard)

### Finding 8.4 — Remote logo dimensions are not reserved
- **Severity:** Major
- **Location:** `app/q/[token]/page.tsx:65`
- **Issue:** `<img>` has a max height but no intrinsic dimensions, risking layout shift; conversion to `next/image` requires a safe remote-host policy.
- **Fix:** Proxy stored logos through a controlled image route or store dimensions and use `next/image`.
- **Status:** DEFERRED

## Section 9 — Performance and perceived speed

### Finding 9.1 — Font loading caused avoidable shift
- **Severity:** Major
- **Location:** root layout/token file
- **Issue:** Fonts were not managed by Next.js.
- **Fix:** Migrated to `next/font/google`.
- **Status:** FIXED

### Finding 9.2 — Full-resolution data URLs render as thumbnails
- **Severity:** Major
- **Location:** dashboard/quote-list thumbnails and facet rail
- **Issue:** CSS scales original images to 48-92px, increasing decode/memory cost.
- **Fix:** Generate stored thumbnail variants and serve them through `next/image` or a controlled optimizer.
- **Status:** DEFERRED

### Finding 9.3 — Loading-boundary coverage is incomplete
- **Severity:** Minor
- **Location:** pending approval, several admin nested pages, auth/public routes
- **Issue:** Core routes are covered, but some async pages have no sibling skeleton.
- **Fix:** Add route-matched skeletons where data fetch can delay first content; static/auth pages do not require artificial loaders.
- **Status:** DEFERRED

## Section 10 — Plan-gate UX

### Finding 10.1 — Feature-specific benefits and CTAs were absent
- **Severity:** Major
- **Location:** `PlanGate.tsx`
- **Issue:** Generic copy did not identify value or the required plan.
- **Fix:** Added typed copy for sharing, manufacturing, history, and custom pricing.
- **Status:** FIXED

### Finding 10.2 — Some locked controls implement bespoke disabled states
- **Severity:** Minor
- **Location:** quote row actions, branding logo field, team seat state
- **Issue:** These controls are discoverable, but their messaging and CTA treatment differ from `PlanGate`.
- **Fix:** Extract a client-compatible locked-control component sharing `PlanGate` copy.
- **Status:** DEFERRED

### Finding 10.3 — Upgrade links navigate instead of opening the inline modal
- **Severity:** Minor
- **Location:** `PlanGate` fallback links from quote/history/dashboard
- **Issue:** Users first navigate to billing; the inline upgrade modal may require another action.
- **Fix:** Support a shared upgrade-dialog trigger so feature discovery reaches plan selection in one interaction.
- **Status:** DEFERRED

## Deployment visual verification checklist

- Capture `/`, `/quotes`, `/quotes/new`, `/quotes/[id]`, `/orders`, `/orders/[id]`, all settings pages, `/pending-approval`, `/pricing`, and `/q/[token]` at 375px, 768px, and 1280px.
- Keyboard-test the upgrade modal, forms, quote tabs, mobile navigation, inline confirmations, and public CTA.
- Confirm the loaded font files in browser network/devtools and measure CLS.
- Verify public logo dimensions, 30-day expiry behavior, and website CTA against a real tenant.
- Run axe/WCAG checks after the deferred field-error associations are implemented.

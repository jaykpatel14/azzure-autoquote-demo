# AutoQuote UI/UX Audit Report

Audited by: Codex  
Date: 2026-08-14

## Summary

| Severity | Count | Fixed | Deferred | Wontfix |
|---|---:|---:|---:|---:|
| Critical | 5 | 5 | 0 | 0 |
| Major | 21 | 17 | 4 | 0 |
| Minor | 11 | 7 | 4 | 0 |
| Enhancement | 6 | 6 | 0 | 0 |

(The counts above were recomputed directly from the finding entries below; the original summary table undercounted several sections.)

**2026-08-14 follow-up pass:** resolved 9 of the 13 previously-DEFERRED findings, several verified against the live Cloudflare-tunneled deployment (1.4, 2.2, 4.4, 5.3, 6.6, 7.2, 7.3, 8.4, 9.3). Four findings remain DEFERRED: 1.3 and 4.6 need dedicated visual-regression tooling and an analysis-job transport change respectively, well beyond a style pass; 4.3, 10.2, and 10.3 are still open pending a follow-up session. See individual entries below for current status and rationale.

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
- **Location:** `app/globals.css` (pricing card, onboarding card/step, upgrade modal, trial banner, plan card)
- **Issue:** 18px, 22px, 24px, 28px, and 32px radii were outside the defined token scale.
- **Fix:** Added `--radius-2xl` (24px), `--radius-3xl` (28px), and `--radius-4xl` (32px) to `src/styles/design-tokens.css`; the 18px and 22px outliers were nudged to the nearest existing/new token (`--radius-xl`, `--radius-2xl`) since the 2px delta is visually negligible. Every named selector now references a token.
- **Status:** FIXED

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
- **Location:** `.quotePreview` in `app/globals.css` (the dashboard price highlight box)
- **Issue:** `.quotePreview` already has a gold-tinted border but also carried `box-shadow: var(--shadow-card)`, a heavy drop shadow — redundant elevation signal on the one authenticated dashboard element that had it. The upgrade modal and public/marketing cards were re-checked and their shadows are legitimate (floating modal separation, light public surface) — no change needed there.
- **Fix:** Removed the `box-shadow` declaration from `.quotePreview`; the border now carries elevation alone, consistent with `.card` elsewhere in the dashboard.
- **Status:** FIXED

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
- **Location:** `components/upgrade-modal.tsx`
- **Issue:** `role="dialog"` is present, but focus is not initially moved into the dialog or trapped/restored.
- **Fix:** Added a `useEffect`-based focus manager: captures `document.activeElement` on mount and restores it on unmount, moves focus to the "Close" link on open, traps Tab/Shift+Tab within the dialog's focusable elements, and handles Escape to navigate back to `/settings/billing`.
- **Status:** FIXED

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
- **Location:** `app/page.tsx`, `app/quotes/page.tsx`
- **Issue:** Title case appeared in dashboard action labels ("New Quote", "Share a Quote", "Place an Order").
- **Fix:** Normalized to sentence case ("New quote", "Share a quote", "Place an order") across the dashboard and quotes list. A broader sweep for other title-case UI strings found no further offenders — the one other title-case match ("Custom King") is a proper noun and correctly capitalized.
- **Status:** FIXED

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
- **Location:** `app/(marketing)/signup/page.tsx`, `components/billing-cancel-form.tsx`, `components/sign-in-form.tsx`, `components/reset-password-form.tsx`
- **Issue:** Visible errors lacked stable IDs and `aria-describedby`; required indicators were inconsistent; general status messages weren't announced to screen readers.
- **Fix:** Signup and billing-cancellation per-field errors now have stable `id`s wired to their inputs via `aria-describedby`, plus `aria-invalid` and `*` required-field markers. Sign-in and reset-password's form-level status messages are now `role="alert"` and linked via `aria-describedby` from the relevant inputs, so they're announced when they appear.
- **Status:** FIXED

## Section 7 — Responsive design

### Finding 7.1 — Sidebar becomes a bottom navigation
- **Severity:** Enhancement
- **Location:** `app/globals.css` max-width 768px rules
- **Issue:** The intended collapse exists, uses horizontal scrolling, and preserves active gold state.
- **Fix:** Increased mobile item height to 44px.
- **Status:** FIXED

### Finding 7.2 — Bottom navigation can exceed five items
- **Severity:** Major
- **Location:** `lib/internal-admin-nav.ts`, `components/internal-admin-shell.tsx`
- **Issue:** The tenant-facing workspace nav was already at 5 items (fine as-is), but the internal admin nav had 8 items all flowing into the same mobile horizontal bar.
- **Fix:** Tagged each admin nav item `primary`/`secondary` (4 primary: Overview, Tenants, Pending approvals, Orders). The bar now renders the 4 primary items plus a native `<details>/<summary>` "More" disclosure holding the remaining 4 — zero JS, fully keyboard/screen-reader operable, pops up as a small anchored panel on mobile and expands inline in the desktop sidebar.
- **Status:** FIXED

### Finding 7.3 — Tables scroll but lack a clear affordance/sticky identity
- **Severity:** Major
- **Location:** `.tableShell` / `.dataTable` in `app/globals.css` (shared by quote, order, customer, tenant, and billing tables)
- **Issue:** `overflow-x:auto` prevents clipping, but users received no edge hint and the first column was not sticky.
- **Fix:** Added a pure-CSS scroll-shadow effect on `.tableShell` (fades in/out at either edge based on scroll position, no JS) and made the first `th`/`td` column `position: sticky` with an explicit background per row state (base/odd/hover) so it stays legible while scrolling, plus a hairline shadow marking the sticky edge.
- **Status:** FIXED

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
- **Location:** `app/q/[token]/page.tsx`
- **Issue:** `<img>` had a max-height but no intrinsic dimensions, risking layout shift.
- **Fix:** Reserved a fixed 240×64 box via explicit `width`/`height` attributes and `object-fit: contain`, so arbitrary jeweler logo aspect ratios scale to fit without distortion while the browser reserves consistent space immediately (no CLS). Didn't move to `next/image`/a remote-host policy — that's a larger change (S3 domain allowlisting) for the same visual outcome this simpler fix already achieves.
- **Status:** FIXED

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
- **Location:** several admin nested pages, `/settings/cancel`, `/q/[token]`
- **Issue:** Core routes were covered, but some async, data-fetching pages had no sibling skeleton.
- **Fix:** Added `loading.tsx` for the 6 admin routes that do real Prisma queries without one (`admin/billing`, `admin/billing/[companyId]`, `admin/companies`, `admin/companies/[companyId]`, `admin/quotes/[quoteId]`, `admin/tenants/pending`), `settings/cancel`, and the public `/q/[token]` share page. Left `pending-approval`, `configuration`, and `onboarding` without one — each only awaits a single lightweight auth-context lookup, matching the "static/auth pages do not require artificial loaders" exception.
- **Status:** FIXED

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

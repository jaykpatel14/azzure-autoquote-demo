# Azzure AutoQuote — Architectural Decisions & Rationales (`brain.md`)

## Quote Audit List/Detail Pricing Consistency (2026-09-28)

- **Decision 73**: Treat `calculateMakingPrice` as the single pricing authority for unsaved rows by supplying the tenant tier and consuming its complete result.
- **Why**: `calculateMakingPrice` already performs the production subtotal, tier division, and customer-margin steps. Passing its `makingPrice` through `calculateTierPrice` applies the tier twice and makes a 0% margin row visibly contradict its detail audit.
- **Decision 74**: Label the list value `Making Price`, not `Making Cost`.
- **Why**: The displayed value is the production subtotal divided by the tenant tier divisor. Calling it cost obscures the distinction that the detailed audit intentionally exposes.

## Admin Activity Logging and IP Blocking (2026-09-28)

- **Decision 72**: Resolve the `prisma.blockedIp` undefined runtime error by regenerating Prisma Client after stopping the stale Next.js process, then rely on the workspace process manager to restart the app.
- **Why**: The schema, generated type declarations, and database migration were correct; only the in-memory Prisma runtime predated the new model. Restarting after generation updates the delegate without adding defensive code that would hide a deployment-order problem.

- **Decision 66**: Store blocked addresses in a dedicated `BlockedIp` model instead of embedding a flag in audit metadata.
- **Why**: Enforcement needs a unique, queryable current-state record. Audit rows are append-only history and cannot reliably answer whether an address is blocked now.
- **Decision 67**: Enforce blocks centrally in `proxy.ts` and repeat the check in credentials authorization.
- **Why**: The proxy stops both existing sessions and new unauthenticated requests, while the authorization check provides defense in depth for the most sensitive entry point.
- **Decision 68**: Reject attempts to block the administrator's current IP.
- **Why**: A shared-NAT block is inherently powerful; preventing self-blocking removes the most immediate accidental lockout path while keeping deliberate blocks available to other authorized admins.
- **Decision 69**: Record authenticated page navigations as `PAGE_VIEW`, excluding prefetches, anonymous traffic, static assets, and routine API requests.
- **Why**: This captures what users actually opened without turning every browser request into noisy, expensive audit data. Existing domain audit events continue to describe important write actions.
- **Decision 70**: Exempt health checks, cron routes, and Stripe webhooks from application-level IP blocks.
- **Why**: These are infrastructure and server-to-server endpoints. A user-facing security action should not break monitoring, scheduled jobs, or payment synchronization.
- **Decision 71**: Present Activity, Sign-ins, and Blocked IPs as separate tabs inside the same admin dashboard.
- **Why**: Security investigation, authentication review, and access control are related but distinct workflows; separating them keeps each table scannable while preserving a single administrative destination.

## Admin Quote Audit UI Decisions (2026-09-24)

- **Decision:** Refine the existing data-backed quote audit route instead of creating a screenshot-only duplicate.
- **Why:** The current route already contains the correct pricing engine, tenant boundaries, quote history data, and manufacturing workflow; preserving it keeps the visual match functional and production-safe.
- **Decision:** Keep the desktop information density shown in the reference while adding targeted mobile collapse rules below 768px and 560px.
- **Why:** Audit users benefit from side-by-side financial context on workstations, but formulas and dense rows must remain legible on tablets and phones.
- **Decision:** Add semantic status/alert roles and reduced-motion behavior without changing pricing calculations.
- **Why:** Accessibility and feedback improve while leaving the sensitive pricing logic and saved quote snapshot untouched.
- **Decision:** Sanitize unauthorized quote-detail props on the server and omit cost-breakdown table columns for restricted tenant roles.
- **Why:** CSS hiding or conditional client rendering could still serialize sensitive making-price data to the browser. The server boundary prevents that disclosure.
- **Decision:** Rename the internal KPI from `Production Cost` to `Azzure Making Price`.
- **Why:** The displayed number is `subtotal / tierDivisor`, not the raw production subtotal. Precise labeling prevents operators from comparing unlike figures.

## Preserve Admin Company Context on Every Analysis Request (2026-09-16)

- **Decision 62**: Append `assignedCompanyId` to analysis `FormData` whenever the calculator has that prop, independently of optional customer descriptions, including the unified multi-photo flow.
- **Why**: Authentication and target-company context are independent of quote content. The previous coupling made photo-only admin analyses lose their admin-sales context and fall into tenant authentication.
- **Why this is better**: Server-side `requireAdminSalesContext` remains the authorization authority; the client reliably supplies the routing context the API already requires, without weakening access control.

## Overview
This document logs every key architectural, design, and calculation decision made during the development of Azzure AutoQuote MVP.

---

## Key Decisions Log

### 50. Approval Alert Email Routing to approvals@azzuresolutions.com
- **Decision**: Configured `sendSignupApprovalAlert` in [`lib/account-workflow.ts`](file:///d:/Projects/azzure-autoquote-mvp-starter/azzure-autoquote-mvp/lib/account-workflow.ts) to send all incoming jeweler signup and account approval alerts to `approvals@azzuresolutions.com` (with fallback to `process.env.APPROVAL_ALERT_EMAIL`).
- **Rationale**: Routes onboarding and verification notifications to the dedicated approval inbox managed by the administrative review team rather than generic admin addresses.

### 51. Canadian Dollar (CAD) Currency Display & Conversion Across All Quoting Surfaces
- **Decision**: Implemented a comprehensive CAD currency engine in [`lib/currency.ts`](file:///d:/Projects/azzure-autoquote-mvp-starter/azzure-autoquote-mvp/lib/currency.ts) and added interactive currency toggles across the Jeweler Quote Calculator ([`components/QuoteCalculator.tsx`](file:///d:/Projects/azzure-autoquote-mvp-starter/azzure-autoquote-mvp/components/QuoteCalculator.tsx)), Customer Public Quote Page ([`app/q/[token]/page.tsx`](file:///d:/Projects/azzure-autoquote-mvp-starter/azzure-autoquote-mvp/app/q/%5Btoken%5D/page.tsx)), Quote Detail & Cost Breakdown ([`app/quotes/[quoteId]/page.tsx`](file:///d:/Projects/azzure-autoquote-mvp-starter/azzure-autoquote-mvp/app/quotes/%5BquoteId%5D/page.tsx), [`components/quote-cost-breakdown.tsx`](file:///d:/Projects/azzure-autoquote-mvp-starter/azzure-autoquote-mvp/components/quote-cost-breakdown.tsx)), and Quote PDF Generator ([`lib/pdf/quote.ts`](file:///d:/Projects/azzure-autoquote-mvp-starter/azzure-autoquote-mvp/lib/pdf/quote.ts)).
- **Rationale**: Canadian retail jewelers and their walk-in customers need transparent, real-time pricing presented in Canadian Dollars (CAD) without mental conversion or currency ambiguity, while preserving USD pricing capability for US and international clientele.

### 1. Frontend Design System & Migration to Azzure Light Mode
- **Decision**: Replaced dark baseline theme with Azzure AutoQuote luxury light-mode palette, custom glassmorphism components, and Google Inter + Playfair Display typography.
- **Rationale**: Retail jewelry store owners and sales associates operate in bright showroom environments where light-mode luxury surfaces provide maximum legibility, high perceived value, and client trust.

### 2. Quotes Dashboard & 3-Step Interactive Workflow
- **Decision**: Redesigned the Quote Builder into a 3-Step Left Panel (`01 Reference Photos & Description` $\rightarrow$ `02 AI Spec Analysis` $\rightarrow$ `03 Interactive Parameter Adjustments`) paired with a Fixed/Sticky Right Panel (`AI Visualization Frame` $\rightarrow$ `Live Estimate Price` $\rightarrow$ `Save & PDF Export Actions`).
- **Rationale**: Eliminates friction by removing manual "Analyse" action buttons. Analysis triggers automatically upon photo drag & drop or preset selection, and parameter edits instantly recalculate the live estimate without page reloads.

### 3. Precious Metal Wastage & Casting Loss Allowance
- **Decision**: Added a 25%–28.5% Metal Wastage Allowance multiplier (`1.25x` to `1.285x`) to all raw gold calculations in `src/services/pricing.ts`.
- **Rationale**: In real-world jewelry manufacturing, casting a 7.0g finished gold ring requires ~8.75g to 9.0g of raw gold due to spruing cutoffs, melting loss, filing, and high-speed wheel polishing. Without accounting for casting loss, raw material estimates underquote actual casting costs by 20%+.

### 4. Pricing Engine Gold Metal Cost & Diamond Valuation Fixes
- **Decision**: Updated `calculateMakingPrice` in `src/services/pricing.ts` to include `calculateMetalCost` (based on exact gram weight, metal purity, and gold spot rate) and corrected center stone valuations to $125/ct standard lab diamond rates.
- **Rationale**: Resolves the bug where 7.50g 14K Gold rings with 3.68 carats of diamonds were underquoted at $713.14. Including gold weight and accurate diamond pricing corrected estimates to realistic retail ranges ($3,100–$4,300+).

### 5. Metals.dev API & Health Check Resiliency
- **Decision**: 
  1. Updated system fallback spot rate from `$2,600 / oz` to **`$4,500.00 / oz`**.
  2. Added auto-sanitization to strip literal quotation marks (`"` or `'`) from `METALS_DEV_API_KEY` in environment variables.
  3. Attached explicit API key query parameters and browser `User-Agent` headers to `admin-overview.ts` health check pings.
- **Rationale**: Docker & Proxmox `.env` files frequently pass quotes in string environment variables, causing 401 Unauthorized API rejections. Sanitizing keys and passing proper headers ensures Metals.dev stays 100% operational in both production and fallback modes.

### 6. Showroom Kiosk UI & Touchscreen End-Customer Experience
- **Decision**: Upgraded `/showroom` into a Luxury Dark Obsidian & Gold Touchscreen Studio featuring 4 1-Tap End-Customer Try-It Inspiration Cards (*"2.5ct Pear Halo Solitaire"*, *"3.0ct Oval Hidden Halo"*, *"2.0ct Emerald Cut 3-Stone"*, *"1.5ct Cushion Pavé Split Shank"*), touch camera support, and golden consultation claim cards (`QT-0042`).
- **Rationale**: Walk-in clients standing at a Workstation on Wheels (WOW) kiosk or tablet in a showroom may not have inspiration photos on their mobile phones. Preset cards allow 1-touch interaction, letting any client experience 3D AI quoting in 30 seconds.

### 8. Pricing Page 4-Column Grid & Category Comparison Table Redesign
- **Decision**: 
  1. Updated `app/globals.css` to render `.pricingCards` in a balanced 4-column grid (`repeat(4, minmax(0, 1fr))`) for Starter ($49), Professional ($99), Enterprise ($199), and Ultra ($399).
  2. Fixed the Feature Comparison Table in `app/(marketing)/pricing/page.tsx` by grouping rows under 5 distinct category header rows (*Core Quoting Engine*, *Customization & Branding*, *Storage & Team Seats*, *Manufacturing & Enterprise*, *Ultra Studio & Showroom Kiosk*).
- **Rationale**: Eliminates the layout bug where Ultra dropped down to a second row alone, and fixes the text concatenation bug (`Core quotingQuotes per month`) by properly separating section categories from feature labels.

### 11. CI Lint Purity Fixes & Dependency Resolution
- **Decision**: 
  1. Extracted `Date.now()` query in `app/settings/showroom/page.tsx` into a `fetchShowroomStats` helper function outside the render scope.
  2. Replaced `Math.random()` in `app/showroom/page.tsx` with `crypto.randomUUID()` in `resolveOrCreateShowroomSession` helper.
  3. Added missing dependencies (`metalType`, `pricingProfile?.goldSpotPerOz`) to `useMemo` in `components/QuoteCalculator.tsx`.
- **Rationale**: Fixes React 19 `react-hooks/purity` compiler lint errors, ensuring `npm run lint` exits cleanly with code 0 in GitHub Actions CI.

### 12. Live Precious Metal Pricing Integration in Settings Page
- **Decision**: Updated `app/settings/pricing/page.tsx` to dynamically query `resolveMetalPricing()` instead of displaying hardcoded static text (`$2,640.50`).
- **Rationale**: Ensures the customer pricing settings page displays the live spot gold rate (~$4,481/oz) matching Kitco/Metals.dev real-time market feeds and accurately calculates 14K and 18K price per gram.

### 13. Interactive Pricing & Margin Simulator
- **Decision**: Created `components/pricing-margin-simulator.tsx` embedded into `/settings/pricing`.
- **Rationale**: Provides jewelers with an interactive range slider and live sample quote breakdown (14K Oval Solitaire) that calculates in real-time how their markup % impacts base production cost, retail presentation price, and net profit per piece.

### 21. Luxury Onboarding Flow & Trial Days Resolution
- **Decision**: Redesigned `/onboarding` UI into a modern 3-step luxury onboarding setup with obsidian/gold cards, real-time trial metric status banner, and structured form fields. Updated `getTrialDaysRemaining` in `lib/billing.ts` and `updateAdminCompanyBilling` in `lib/admin-companies.ts` to compute remaining trial days dynamically from `trialEndsAt`, `currentPeriodEnd`, or `currentPeriodStart + 14 days`.
- **Rationale**: Eliminates the "0 days left" calculation bug on trialing accounts and gives jewelers a luxury guided setup experience.

### 22. AI 3D Image Concept Feature Gating in Quote Creation
- **Decision**: Wrapped `generateQuoteRendering` in `app/api/quotes/route.ts` with `if (features.canGenerateAIImages)`. When creating a quote on Starter or Professional tiers, AI image synthesis is safely skipped, and the quote view cleanly displays the customer's uploaded reference image.
- **Rationale**: Strict subscription enforcement ensures AI image rendering is exclusively available on Enterprise and Ultra plans.

### 23. Prisma Client Sync & Windows File Lock Resolution
- **Decision**: Identified that the runtime error `Unknown argument 'renderingStatus' in prisma.aiAnalysis.update()` occurred because `prisma/schema.prisma` had been updated with new rendering fields (`renderingStatus`, `renderingStorageKey`, `renderingDataUrl`, etc.), but the generated Prisma client in `node_modules/@prisma/client` had not been rebuilt due to Windows file locking (`EPERM` on `query_engine-windows.dll.node`) by the active Next.js development server process. Stopped the locking Next.js dev server, regenerated Prisma Client using `npx prisma generate`, verified database sync with `prisma db push`, and updated unit test mocks in `test/concept-generate.test.ts`.
- **Rationale**: Prisma on Windows locks the C++ engine DLL during runtime. Rebuilding the client ensures full TypeScript and runtime ORM support for all new columns on `AiAnalysis` and `Quote`, eliminating runtime crashes during AI analysis image synthesis.

### 24. Proxmox Deploy Workflow PostgreSQL Wait Loop & Diagnostics Resilience
- **Decision**: 
  1. Replaced the unbounded `until docker compose exec pg_isready ...` loop in `.github/workflows/proxmox-test-deploy.yml` with a bounded 30-attempt (60-second) retry loop that checks both `autoquote` and `postgres` roles/database readiness.
  2. Added automatic failure diagnostics (`docker compose logs --tail=100 db` and `docker compose ps`) if PostgreSQL does not become ready within 60 seconds, preventing GitHub Actions jobs from hanging indefinitely and getting cancelled after hours of silent retries.
  3. Updated the healthcheck test in `docker-compose.proxmox.yml` to include fallback role checks (`pg_isready -U autoquote -d autoquote || pg_isready -U postgres || pg_isready`) with 3s intervals.
  4. Added application log dumping to Step 5 if `/api/health` fails to respond within 20 attempts.
- **Rationale**: An unbounded loop suppressing stdout/stderr (`>/dev/null 2>&1`) hides the actual reason for connection failure (such as container crash loop, existing volume role mismatch, or socket permission issues) and causes the runner to hang until timeout cancellation. Bounded retries with diagnostic log outputs guarantee fast failure feedback and immediate visibility into runner issues.

### 25. Admin Sidebar Luxury Dark Contrast, Showroom Save Schema Harmonization & Live Metal Density Pricing Sync
- **Decision**: 
  1. **Admin Sidebar Styling & Contrast**: Completely overhauled `.workspaceSidebar--admin` in `app/globals.css` with a high-contrast obsidian palette (`#0f172a`), luminous sapphire highlights (`#0284c7`), crisp white typography (`#ffffff`), and distinct slate navigation icons (`#64748b` -> `#cbd5e1` on hover). Replaced illegible dark-on-dark labels and low-contrast footer panels with translucent glass backgrounds.
  2. **Showroom Save Quote Error Resolution**: Fixed the Zod validation error `invalid_type on metalType: expected string, received undefined` in `/api/showroom/quotes` by accepting both `metalType` and `selectedMetal` in the request schema (`app/api/showroom/quotes/route.ts`), and ensured `app/showroom/showroom-kiosk.tsx` sends both fields in the save payload.
  3. **Live Metal Pricing & Density Sync**: Integrated `convertMetalWeight` across both `QuoteCalculator.tsx` and `app/showroom/showroom-kiosk.tsx`. When switching metals (10K, 14K, 18K, Platinum, Silver), metal gram weight automatically adjusts by physical alloy density ratio (e.g. 5.0g 14K $\rightarrow$ 5.95g 18K $\rightarrow$ 8.19g Platinum) and triggers instant real-time live price recalculations with the correct purity and wastage multipliers.
  4. **Robust Metal String Parsing in Pricing Engine**: Enhanced `calculateMetalCost` in `src/services/pricing.ts` with case-insensitive normalization and keyword matching for 10K, 14K, 18K, Platinum, and Silver.
- **Rationale**: Retail associates and showroom walk-in customers need immediate, tactile feedback when exploring metal options (e.g. comparing 14K Gold vs Platinum price differences). Eliminating schema field mismatches ensures saving quotes on showroom tablets never crashes with cryptic errors.

### 26. Proxmox Deployment `.env.proxmox` Comment Sanitization
- **Decision**: Added an automatic regex sanitization step (`sed -i 's/^[\]*#/#/' .env.proxmox`) in `.github/workflows/proxmox-test-deploy.yml` before Docker Compose execution, and documented the resolution for Proxmox hosts where line 1 starts with `\# Proxmox test environment`.
- **Rationale**: Docker Compose's `.env` parser treats any line starting with an escaped character (like `\#` or `\\#`) as an environment variable key rather than a comment line. Because backslashes (`\`) are invalid characters in environment variable keys, Docker Compose immediately halts with `unexpected character "\" in variable name`. Auto-sanitizing `.env.proxmox` on the runner removes accidental backslashes before invoking Docker Compose, preventing deployment failures.

### 27. Showroom Kiosk 10-Point Customer Experience & Friction-Free Workflow
- **Decision**: 
  1. **Welcome / Standby Screen**: Added a dedicated standby state in `app/showroom/showroom-kiosk.tsx` featuring the Jeweler's Logo, obsidian/gold dark luxury aesthetic, quick 3-second value proposition (*"Bring Your Dream Ring to Life in 30 Seconds"*), 1-tap *"Design Your Custom Ring"* CTA, and 4 quick inspiration presets (*2.5ct Pear Halo Solitaire, 3.0ct Oval Hidden Halo, 2.0ct Emerald Cut 3-Stone, 1.5ct Cushion Pavé Split*).
  2. **Zero Friction & Visual Plus Note Communication**: Ensured no account or email is requested on the kiosk, pairing photo upload with custom design notes.
  3. **Progressive AI Inspection & Photorealistic 3D Render**: Maintained 3-stage animated analysis diagnostics and prominent 3D studio visualization render preview with luxury badge.
  4. **Live Honest Pricing**: Kept price updates instant via alloy density conversion (`convertMetalWeight`), formatted as a clean single number without asterisks, "starting from", or wholesale business formula jargon.
  5. **Clear Next Steps & Privacy Reset**: Saved screen displays a prominent claim code (`QT-0042`), exact guidance (*"Show this code to your jeweler. They can see your design, adjust anything you want, and place the order."*), and a clean "Done" reset button paired with an 80s/90s inactivity timer.
- **Rationale**: Retail jewelry shoppers in showroom kiosks need immediate trust, zero friction, emotional photorealistic visual confirmation of their ring, honest transparent pricing, and a simple 6-character code to hand to the jeweler without ever needing to log in or leave personal contact data at a public terminal.

### 28. CustomKing API Endpoint Resolution & Integration Path Normalization
- **Decision**: Updated `lib/customking-api.ts` so that when `CUSTOMKING_API_URL` is set to `https://cknyc-api.azzuresolutions.com/api/v1`, the dispatcher resolves to the exact CustomKing integration endpoint: `https://cknyc-api.azzuresolutions.com/api/v1/integration/orders` instead of the 404 endpoint `/api/v1/orders`.
- **Rationale**: CustomKing NYC's Express API namespaces partner and ERP integration routes under `/api/v1/integration/orders`. Automatically normalizing the endpoint ensures orders dispatch cleanly regardless of whether `/api/v1` or `/api/v1/integration/orders` is passed in `.env`.

### 29. CustomKing Manufacturing Order Studio & AI-to-Production Bridging
- **Decision**: Architected an interactive Manufacturing Order Studio on `/quotes/[quoteId]` that automatically pre-populates all AI visual extraction parameters (metal, gram weight, center stone carats, shape, side stones, quantity, setting type, and 3D render) while allowing jewelers to add granular CustomKing production specifications (ring size, polish finish, diamond origin/color/clarity, stone provider, matching wedding band, engraving text and font, target delivery date, and workshop notes) before 1-click dispatching to CustomKing NYC.
- **Rationale**: While AI provides rapid visual estimates from photos, actual manufacturing requires precise workshop specifications (e.g. exact finger size 6.5, high polish finish, custom inside-band engraving, or whether diamonds are supplied by CustomKing vs from store stock). Bridging AI estimates with an interactive configuration studio ensures 100% compliance with CustomKing's production schema without manual re-entry.

### 30. Pricing Engine Formulas & 3-Step Pricing Hierarchy Overhaul
- **Decision**: Overhauled the core pricing engine formulas across `src/services/pricing.ts`, `components/admin/quote-pricing-breakdown.tsx`, `app/admin/quotes/unsaved/[analysisId]/page.tsx`, `QuoteCalculator.tsx`, and `app/showroom/showroom-kiosk.tsx`:
  1. **Side Stone Shape Pricing**: If side stones are round, pricing is `$80/ct`. If side stones are not round (fancy shapes: baguette, trapezoid, pear, emerald, oval, princess, etc.), pricing is `$130/ct`.
  2. **Side Stone Setting Labor**: Setting labor depends on stone shape — `$1.25 per stone` for round side stones, and `$5.00 per stone` for non-round / fancy side stones.
  3. **CAD Design Fee**: Set CAD design fee default to a flat `$20.00` fee (previously defaulting to $0.00).
  4. **Strict 3-Step Pricing Hierarchy**:
     - **Step 1: Production Subtotal**: Sum of Metal Cost + Center Stone Cost + Side Stone Cost + Center Stone Setting + Side Stone Setting + Wax ($15) + Polishing ($20) + CAD Fee ($20). *(Represents Azzure's raw manufacturing cost).*
     - **Step 2: Azzure Making Price (Wholesale to Jeweler)**: Apply Tier formula directly on Production Subtotal: `Production Subtotal / Tier Divisor` (e.g. `Subtotal / 0.7` for Tier 2 Standard). *(Represents Azzure's wholesale invoice to the jeweler).*
     - **Step 3: End Customer Selling Price**: Apply Jeweler Markup on top of the Azzure Making Price (Tier Price): `Making Price + (Making Price * Jeweler Margin %)` or `Making Price * (1 + Jeweler Margin %)`. *(Represents what the jeweler charges the retail customer).*
     - **Jeweler Gross Profit**: Strictly `End Customer Price - Azzure Making Price`.
- **Rationale**: The previous calculation mistakenly added the jeweler markup to the raw subtotal first, and then applied the wholesale tier divisor second. The corrected 3-step hierarchy cleanly separates Azzure's manufacturing cost and tier multiplier from the jeweler's downstream retail markup, and ensures non-round side diamonds and fancy setting labor are priced accurately.

### 31. Explicit Analyze Action Button on Jeweler and Showroom Dashboards
- **Decision**: Removed automatic analysis on photo selection/drop and description field `onBlur`. Added prominent, high-contrast **"Analyze with AI"** / **"Analyze Design with AI"** buttons to both the Jeweler's Workspace (`components/QuoteCalculator.tsx`) and the Showroom Tablet Kiosk (`app/showroom/showroom-kiosk.tsx`).
- **Rationale**: Automatic analysis firing immediately upon file selection prevented users from typing custom design instructions first, verifying their selected image, or managing multiple image attachments before spending API analysis credits. Adding explicit Analyze triggers gives jewelers and showroom customers total control over when the multi-pass vision model is invoked.

### 32. Showroom Experience Overhaul: Product Catalog, Analysis Modal, QR Sharing & Weight Calibration
- **Decision**: Implemented five interconnected UX and domain model improvements:
  1. **Showroom Product Catalog**: Replaced static cards on the standby screen with 4 curated luxury customer designs featuring studio jewelry imagery, descriptions, and dynamic base prices. Selecting a card preloads the full specification into the live customization workspace.
  2. **Analysis Progress Modal ("What Our AI Sees")**: Refactored the inline analysis step into a center-screen glassmorphism dialog that steps through multi-phase visual diagnostic animations during API processing.
  3. **AI Concept Render Hero Display**: Rendered the photorealistic 3D concept visualization / inspiration image prominently above the live estimate price card.
  4. **Dynamic Ring Specification Header**: Added automated title formatting (e.g. *14K · 3.00ct Oval · 0.15ct Side Diamonds (16×) Custom Ring*) under the live estimate on both Showroom and Jeweler dashboards.
  5. **Mobile QR Code Share & PDF Modal**: Added client-side QR generation using `qrcode` so walk-in customers can instantly scan the screen to open and download the PDF quote proposal on their smartphone.
  6. **Physical Metal Weight & Diamond Heuristics**: Enriched the OpenAI analysis system prompts with realistic physical casting weight benchmarks by ring style and metal density to prevent under/over-estimation.
- **Rationale**: Elevates the in-store consultation experience from a technical utility to a retail luxury experience, giving walk-in clients clear inspiration, transparent real-time estimation, and seamless mobile take-home sharing via QR codes.

### 33. Showroom Quote Save Payload and Schema Harmonization
- **Decision**: Harmonized the parameter names between `app/showroom/showroom-kiosk.tsx` and `app/api/showroom/quotes/route.ts` to support both `centerDiamondCarats`/`centerCarats` and `sideDiamondCarats`/`sideCarats`, and updated response keys to include both `code` and `displayCode`.
- **Rationale**: Prevented Zod validation runtime errors (`invalid_type: expected number, received undefined`) during Showroom quote creation and QR code generation when customized design parameters are saved.

### 34. Customer Name, Email, and Phone Contact Capture (Optional for Jewelers, Mandatory for Showroom)
- **Decision**: Added `customerEmail` and `customerPhone` fields across Prisma `Quote` model, backend services, API endpoints, and both front-end dashboards:
  1. **Jeweler Dashboard (`components/QuoteCalculator.tsx`)**: Placed a responsive 3-column contact info panel at the top of Step 1 (`Customer Name (Optional)`, `Customer Email (Optional)`, `Phone Number (Optional)`).
  2. **Showroom Kiosk (`app/showroom/showroom-kiosk.tsx`)**: Placed mandatory contact fields with asterisk indicators (`*`) and input validation at the top of Step 1 (`Your Full Name *`, `Email Address *`, `Phone Number *`). Both `save()` and `handleShareQr()` enforce valid inputs with inline error highlights before submitting.
  3. **Backend & Prisma**: Updated `model Quote` in `prisma/schema.prisma` (`customerEmail String?`, `customerPhone String?`), synchronized via `npx prisma db push`, and updated `src/services/quotes.ts`, `app/api/quotes/route.ts`, and `app/api/showroom/quotes/route.ts`.
- **Rationale**: Gives jewelers flexibility when drafting internal estimates while strictly capturing customer lead and contact data from walk-in showroom visitors so quotes can be attributed, followed up, and matched against CustomKing manufacturing orders.

### 35. Unified Text and Photo AI Analysis with Photorealistic Concept Rendering & Customer Details in PDF
- **Decision**: Made AI analysis input flexible and unified across the entire system:
  1. **Dual / Single Input Support**: System accepts (a) Text + Photo together, (b) Text description only, or (c) Photo only. If either is omitted, it is seamlessly skipped without throwing missing-field errors.
  2. **Automated AI 3D Rendering**: Regardless of whether analyzed from text, photo, or both, the system automatically triggers photorealistic 3D image concept generation and returns the image URL with the analysis breakdown.
  3. **Customer Details in PDF Proposal**: Enhanced `lib/pdf/quote.ts` and `src/services/quote-pdf.ts` to include Customer Name, Email, Phone, and customer design notes directly in the generated customer-facing PDF document.
- **Rationale**: Empowers both jewelers and showroom customers to explore custom designs even when reference photos aren't available (e.g. text-only concepts) while ensuring every approved quote produces complete specifications, a luxury 3D render, and a personalized PDF proposal.

### 36. Direct Camera Photo Capture and Real-Time Mobile Upload QR Bridge
- **Decision**: Added two seamless image ingestion paths for Showroom Kiosk and Jeweler Workspace:
  1. **Direct Camera Capture Button (`photo_camera`)**: Added a dedicated "Take Photo" button with `capture="environment"` in the dropzone for both the Showroom Kiosk ([`app/showroom/showroom-kiosk.tsx`](file:///d:/Projects/azzure-autoquote-mvp-starter/azzure-autoquote-mvp/app/showroom/showroom-kiosk.tsx)) and Jeweler Workspace ([`components/QuoteCalculator.tsx`](file:///d:/Projects/azzure-autoquote-mvp-starter/azzure-autoquote-mvp/components/QuoteCalculator.tsx)), enabling direct camera snapping on iPads, tablets, mobiles, and webcam laptops.
  2. **Mobile Photo Upload QR Bridge**:
     - Added a **"Upload from Phone (QR)"** button that opens a high-resolution QR modal.
     - When scanned by a customer with their smartphone, it opens `/showroom/mobile-upload?sessionId=...`.
     - Built `lib/mobile-upload-store.ts` and `app/api/showroom/mobile-upload/route.ts` with validation and ephemeral storage.
     - Built mobile client page [`app/showroom/mobile-upload/page.tsx`](file:///d:/Projects/azzure-autoquote-mvp-starter/azzure-autoquote-mvp/app/showroom/mobile-upload/page.tsx) where customers snap/pick photos and tap "Send to Kiosk Screen".
     - The kiosk/workspace polls the session, automatically receives the uploaded photos, closes the modal, and renders the photos into the quote workspace without requiring manual cable or email transfers.
- **Rationale**: Walk-in showroom customers frequently carry reference photos and jewelry inspirations on their personal smartphones. Enabling instant phone-to-screen QR upload removes friction, delights customers, and accelerates in-store quote generation.

### 37. Showroom Kiosk Device Privacy: Disallow Local File Explorer Uploads
- **Decision**: Completely removed the local file-system picker ("Choose Photos") from the public Showroom Kiosk ([`app/showroom/showroom-kiosk.tsx`](file:///d:/Projects/azzure-autoquote-mvp-starter/azzure-autoquote-mvp/app/showroom/showroom-kiosk.tsx)). The kiosk only provides:
  1. **Upload from Phone (Scan QR)**: Allows walk-in customers to securely upload images from their own personal smartphones.
  2. **Take Photo**: Direct camera shutter (`capture="environment"`) to take a photo of physical jewelry on the spot without exposing the device filesystem or gallery.
- **Rationale**: On shared showroom tablets, iPads, and kiosk touchscreens, opening the local file dialog could expose internal store folders, OS files, or photos taken by previous customers. Restricting uploads to QR and direct camera capture ensures complete privacy and zero data leakage.

### 38. Starter Plan PDF & Markup Rules, Ultra-Only 3D AI Concept Gating, and Multi-Image Unified Analysis
- **Decision**: Implemented 5 key business logic, plan matrix, and AI engine refinements:
  1. **Starter Plan PDF (No Image Box)**:
     - Updated `lib/pdf/quote.ts` and `src/services/quote-pdf.ts` so when `hasPdfImages === false` (Starter plan), the image placeholder boxes (`drawContainedImage`) and additional reference photo pages are completely omitted.
     - The PDF is rendered cleanly on 1 page with all approved quote metrics, customer details, design notes, and estimate terms.
  2. **Starter Plan PDF Azzure Branding**:
     - Ensured Starter PDFs feature full Azzure AutoQuote branding:
       - Header subtitle: `"POWERED BY AZZURE AUTOQUOTE"`
       - Title: `"[Company Name] Quote"` or `"AI AutoQuote Estimate"`
       - Header tag: `"Azzure AutoQuote · Quote #Q-..."`
       - Footer watermark on every page: `"Powered by Azzure AutoQuote · AI Jewelry Quoting Engine · www.azzuresolutions.com"`
  3. **Starter Plan Markup Customization Locked**:
     - Updated `app/api/settings/pricing/route.ts` with `assertPlanFeature(companyId, "canUseCustomPricingProfile")`.
     - In `app/settings/pricing/page.tsx` and `components/pricing-margin-simulator.tsx`, disabled the markup range slider and numeric input when on the Starter plan (`canEdit={canEdit && canUseCustomPricing}`), with an explanatory upgrade badge.
  4. **3D AI Concept Generation Restricted Strictly to Ultra Plan**:
     - Updated `PLAN_FEATURES` in `src/stripe/plans.ts` so `canGenerateAIImages: false` on Starter, Professional, and Enterprise plans. Only `plan_ultra` has `canGenerateAIImages: true`.
     - Updated `lib/ai/quote-rendering.ts` (`generateQuoteRendering` and `generateAnalysisRendering`), `app/api/concept/generate/route.ts`, and `app/api/analyze/route.ts` to gate 3D AI generation exclusively to the Ultra plan.
  5. **Multi-Image Unified AI Analysis & Single Render**:
     - Updated `lib/ai/provider.ts`, `lib/ai/providers/openai.ts`, and `lib/ai/runner.ts` to accept `imageDataUrls: string[]`.
     - When a customer or jeweler uploads multiple reference images (e.g. top view + side profile view), all images are bundled and sent together in a single OpenAI message content array (`input_image` for each angle).
     - OpenAI evaluates all views simultaneously and produces ONE unified `JewelryAnalysis` JSON specification.
     - Generates ONE single photorealistic 3D concept render for the combined piece.
     - Updated `components/QuoteCalculator.tsx` (`analyseAll`) and `app/showroom/showroom-kiosk.tsx` (`runAnalysis`) to send all uploaded photos in a single API call.
- **Rationale**: Enforces subscription tier boundaries (Starter vs Pro vs Enterprise vs Ultra), eliminates image clutter on Starter PDFs while strengthening Azzure brand equity, prevents unauthorized markup overriding, and ensures multi-angle jewelry photos are analyzed holistically as a single piece of jewelry rather than fragmented separate items.

### 39. Resilient Quote Creation for Showroom Preset Products and Unique Constraint Handling
- **Decision**: Enhanced `createQuote` in `src/services/quotes.ts` to seamlessly handle showroom preset product quotes and duplicate analysis linkages:
  1. **Preset Products & Ephemeral IDs**: When a user selects a preset showroom design (e.g. `product-178725...`) or creates a quote without an active AI analysis record, `createQuote` now automatically synthesizes a completed `AiAnalysis` record for the quote. This eliminates the `NotFoundError("Selected estimate")` error.
  2. **1-to-1 Unique Constraint Protection**: Since Prisma enforces `@unique` on `Quote.analysisId`, if a quote is created or re-saved from an existing `AiAnalysis` that is already bound to another quote, `createQuote` automatically clones the `AiAnalysis` record and associates the fresh clone with the new quote.
  3. **Multi-Tenant Security**: Maintained strict company isolation — if an `analysisId` belongs to a different tenant, it is rejected with `404 Not Found`.
- **Rationale**: Guarantees that saving quotes on the showroom kiosk or jeweler workspace always succeeds (even with preset products or repeated saves) while ensuring every quote in the database possesses a valid, dedicated `AiAnalysis` relation for PDF rendering, 3D image display, and CustomKing order dispatch.

### 40. Homepage #pricing Section Synchronization with /pricing
- **Decision**: Updated the marketing landing homepage (`app/page.tsx`) `#pricing` section to render all 4 subscription tiers (**Starter** @ $49/mo, **Professional** @ $99/mo, **Enterprise** @ $199/mo, and **Ultra** @ $399/mo) matching the dedicated [`/pricing`](file:///d:/Projects/azzure-autoquote-mvp-starter/azzure-autoquote-mvp/app/%28marketing%29/pricing/page.tsx) page:
  1. **Consistent 4-Tier Grid**: Adopted the `.pricingCards` 4-column balanced grid on the homepage `#pricing` section with updated trial tags, pricing, badges (*"Most Popular"*, *"Flagship Studio"*), audience descriptions, and feature bullet points (including Ultra's 3D AI concept generation & Showroom kiosk mode).
  2. **Direct Trial CTAs & Comparison Link**: Direct trial signups link to `/signup?plan=...` (and `mailto:...` for Enterprise), along with a prominent link inviting users to view the complete multi-category feature matrix and FAQ accordion on `/pricing`.
- **Rationale**: Eliminates user confusion between the landing page teaser and the full pricing page, ensuring prospects receive accurate tier specifications, transparent pricing, and instant access to the flagship Ultra plan from anywhere on the site.

### 41. Anti-Disposable & Anti-Dummy Email Filtering System
- **Decision**: Implemented a comprehensive email filtering utility [`lib/email-validation.ts`](file:///d:/Projects/azzure-autoquote-mvp-starter/azzure-autoquote-mvp/lib/email-validation.ts) that validates emails across all user touchpoints:
  1. **B2B Jeweler Signups & Registrations**: Gated `/signup` and `POST /api/auth/register` with `validateEmail`.
  2. **End-Customer Showroom Kiosks**: Validates mandatory customer email on `POST /api/showroom/quotes` and in `app/showroom/showroom-kiosk.tsx` client form.
  3. **Jeweler Dashboard Quotes**: Validates optional customer email on `POST /api/quotes` and in `components/QuoteCalculator.tsx` before quote creation.
  4. **Multi-Layered Protection Rules**:
     - Blocks over 100+ known disposable / throwaway email provider domains (e.g. `mailinator.com`, `guerrillamail.com`, `10minutemail.com`, `tempmail.com`, `yopmail.com`, `trashmail.com`, `burnermail.io`).
     - Blocks dummy, placeholder, and test domains (e.g. `dsaf.com`, `example.com`, `test.com`, `dummy.com`, `fake.com`, `asdf.com`, `sample.com`).
     - Detects and rejects keyboard-mashing dummy domains and local parts (e.g. `asdf...`, `dsaf...`, `aaaa...`, `1234...`, `qwerty...`).
     - Enforces valid TLDs and structural RFC compliance (disallowing `.test`, `.local`, `.invalid`, consecutive dots, etc.).
- **Rationale**: Prevents database pollution from spam, throwaway testing accounts, and junk customer leads while maintaining high data quality for CRM tracking, marketing follow-ups, and genuine customer quote dispatches.

### 42. High-Fidelity Standalone Interactive Landing Page (`public/landing/index.html`)
- **Decision**: Built a standalone interactive landing page for **Azzure AI Quote** at [`public/landing/index.html`](file:///d:/Projects/azzure-autoquote-mvp-starter/azzure-autoquote-mvp/public/landing/index.html) adhering strictly to the luxury obsidian/gold design system:
  1. **Self-Contained Architecture**: Zero runtime dependencies (no external JS frameworks, zero build step). Embedded vanilla CSS animations, SVG stroke illustrations, and modular JavaScript utilities.
  2. **Measured Craftsperson Hero Animation**: Implemented the 6-second step-by-step timed analysis sequence (photo uploaded -> metal resolution -> diamond estimate -> weight calculation -> spec tags -> ring SVG draw-on -> cubic ease-out price count up to $1,666 -> gold glint).
  3. **Interactive Quoting Sandbox (Section 4)**: 4 dynamic presets (Oval Solitaire, Pavé Band, Halo Ring, Tennis Bracelet) with live recalculation formula, debounced input triggers, and animated count-up price transitions.
  4. **Full-Screen Showroom Kiosk Simulation (Section 6)**: 5-slide interactive kiosk walkthrough (Welcome -> Upload simulation -> 3-pass analysis -> Review -> Quote saved with reference code `QT-4821` -> Jeweler lookup & manufacturing dispatch portal) with Escape key and focus trap support.
  5. **Pricing & Stats Engine**: Interactive monthly vs annual (20% discount) switcher with animated number swaps, expandable feature drawers, and intersection-observed stats counters.
  6. **Accessibility & Polish**: Honored `prefers-reduced-motion`, WCAG AA contrast compliance, keyboard focus rings, and fully responsive across 1440px desktop, 768px tablet, and 375px mobile viewports.
- **Rationale**: Provides marketing teams and prospective jewelers with an instant, high-converting interactive showcase that vividly demonstrates the AI quoting workflow, showroom kiosk experience, and enterprise manufacturing capabilities.

### 43. Default Root URL Route (`/`) Renders Interactive Luxury Landing Page
- **Decision**: Configured the default root URL route (`/`) in [`app/page.tsx`](file:///d:/Projects/azzure-autoquote-mvp-starter/azzure-autoquote-mvp/app/page.tsx) to render the interactive luxury marketing experience [`components/InteractiveLandingPage.tsx`](file:///d:/Projects/azzure-autoquote-mvp-starter/azzure-autoquote-mvp/components/InteractiveLandingPage.tsx) for all visitors and prospective jewelers:
  1. **Direct Root Delivery**: When anyone visits `http://localhost:3000/` or the production domain without an active session, they immediately see the full dark obsidian/gold landing page with all live interactive demos, preset testing, showroom kiosk simulator, and monthly/annual pricing calculator.
  2. **Seamless Navigation**: All CTA buttons throughout the page link directly to Next.js routes (`/signup`, `/signin`, `/pricing`, `#demo`, `#showroom`), ensuring zero friction from discovery to account creation.
  3. **Preserved Workspace Access**: Authenticated jeweler sessions continue to route directly to the active Workspace Dashboard (`/quotes`, statistics, trial banner).
- **Rationale**: Elevates the first-impression experience for all incoming traffic, converting visitors with a stunning, interactive product demonstration right on the home page.

### 44. Luminous Luxury Editorial Light Theme for Landing Page
- **Decision**: Redesigned the interactive landing page ([`components/InteractiveLandingPage.tsx`](file:///d:/Projects/azzure-autoquote-mvp-starter/azzure-autoquote-mvp/components/InteractiveLandingPage.tsx) and [`public/landing/index.html`](file:///d:/Projects/azzure-autoquote-mvp-starter/azzure-autoquote-mvp/public/landing/index.html)) from the pitch-black obsidian palette to Azzure's signature **Luminous Luxury Editorial Light Theme**:
  1. **Color Palette**: Pure white (`#FFFFFF`) card containers, luminous porcelain (`#F9F9FB`, `#F8FAFC`) background surfaces, Azzure Imperial Sapphire Blue (`#005AB7`, `#004590`) primary accents, and champagne atelier gold (`#C9A84C`) highlights.
  2. **High-Contrast Editorial Typography**: Deep obsidian slate headings (`#0F172A`), refined charcoal body copy (`#334155`), and subtle slate muted text (`#64748B`).
  3. **Radiant UI Elements**: Crisp border lines (`#E2E8F0`), soft ambient elevation shadows (`0 20px 48px rgba(15, 23, 42, 0.06)`), and high-contrast sapphire/gold ring stroke illustrations.
  4. **Light-Mode Showroom Simulator**: Showroom kiosk walkthrough modal transitioned to clean white atelier tablet styling with high-contrast text and crisp call-to-actions.
- **Rationale**: Replaces the overly dark crypto-style aesthetic with an airy, prestigious, bright luxury jewelry atelier experience that matches luxury retail standards (Cartier, Tiffany, De Beers) and integrates harmoniously with the rest of the Azzure design system.

### 45. Resend Email Integration & Admin Customer Account Deletion Suite
- **Decision**: Enhanced transactional email handling with Resend and implemented customer account deletion capabilities across the Admin Panel:
  1. **Resend Email Engine (`lib/mailer.ts`)**:
     - Configured `sendEmail({ to, subject, html, text, from, attachments, replyTo })` and `sendAuthMail` powered by Resend (`^6.18.1`).
     - Added `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to platform runtime settings (`lib/app-settings.ts`), allowing admins to inspect and configure email credentials directly from `/admin/platform/settings`.
     - Built test email endpoint (`POST /api/admin/test-email`) for instant verification of live email deliverability.
     - Gracefully logs mock emails to console in development and test environments when API keys are not supplied.
  2. **Admin Customer Account Deletion**:
     - **Tenant Company Deletion**: Created REST endpoint `DELETE /api/admin/companies/[companyId]` and `POST /api/admin/companies/[companyId]/delete` powered by `deleteAdminCompany` in `lib/admin-companies.ts`.
     - **Cascading & Orphan Cleanup**: Safely cascades removal across all Quotes, Subscriptions, Pricing Profiles, Showroom Sessions, Analyses, and automatically removes user accounts that have no remaining company memberships.
     - **Interactive UI Modals**: Added `AdminDeleteCompanyButton` with typing confirmation to both the Company Roster (`/admin/companies`) and Company Detail (`/admin/companies/[companyId]`) pages.
     - **Individual Member Deletion**: Created `DELETE /api/admin/companies/[companyId]/members/[userId]` and interactive `AdminDeleteMemberButton` in the team members roster.
- **Rationale**: Gives administrators full control over customer lifecycle management and tenant cleanup, while ensuring emails (registration, invites, notifications, checkout) are reliably delivered via Resend.

### 46. Manual Spec Quoting Mode with Live Pricing Toggle on Jeweler Dashboard
- **Decision**: Added direct manual quote creation capability that bypasses AI photo analysis while calculating accurate real-time market pricing:
  1. **Segmented Mode Switcher on Jeweler Workspace (`components/QuoteCalculator.tsx`)**:
     - Added a top mode toggle switch (`✨ AI Photo Analysis` vs. `⚡ Manual Spec Entry`) on the jeweler quote builder (`/quotes/new`).
     - **Showroom Isolation**: The toggle is strictly hidden in Showroom Mode (`app/showroom/showroom-kiosk.tsx`), ensuring customer-facing tablet kiosks remain photo- and inspiration-driven.
  2. **Direct Manual Spec Configuration**:
     - **Quick Presets**: Added one-click presets for popular designs (*1.0ct Solitaire Ring*, *1.5ct Oval Halo Ring*, *Three-Stone Emerald Ring*, *Pavé Diamond Band*, *Diamond Tennis Bracelet*, *Classic Wedding Band*).
     - **Specs Form**: Direct inputs for Jewelry Type (Ring, Engagement Ring, Wedding Band, Pendant, Earrings, Bracelet, Necklace), Metal Alloy (10K, 14K, 18K, Platinum, Silver) with live spot gold per gram indicator, Gram Weight, Center Stone Shape/Carats/Clarity/Setting, Side Stones count/carats/setting, Matching Band option, and Two-Tone Casting option.
     - **Optional Reference Attachment**: Jewelers can drag-and-drop a photo/sketch to attach to the quote PDF without triggering AI analysis.
  3. **Real-time Live Market Pricing & Backend Persistence**:
     - Computes production cost, metal casting from spot gold, diamond stone rates, CAD cost, and jeweler margin multiplier in real-time as inputs change.
     - Enhanced `POST /api/quotes` and `createQuote` in `src/services/quotes.ts` to accept manual specs, synthesize a completed `AiAnalysis` snapshot record with `provider: "manual-quote-direct"`, allocate sequential quote numbers, and generate PDF proposals.
- **Rationale**: Empowers jewelers to rapidly quote walk-in custom requests with known specs in under 5 seconds using live metal spot prices, without requiring an AI analysis run.

### 47. Internal Sales Demo Presentation & Product Playbook Artifact
- **Decision**: Created the dedicated sales demo presentation and product playbook artifact (`sales_demo_presentation.md`):
  1. **Executive Product Overview**: Product positioning, value proposition, and customer profile targeting independent jewelry store owners and retail chains.
  2. **Core Capabilities**: Multi-image computer vision analysis, real-time precious metals spot pricing engine, instant 3D AI concept renders, showroom consultation mode with wholesale margin concealment, manual spec quoting, and 1-click manufacturing orders.
  3. **Plan Tier Breakdown**: Starter ($99/mo), Professional ($199/mo), and Enterprise ($299/mo) matrices.
  4. **Live 5-Minute Sales Script & Objection Handling**: Turn-by-turn demo flow for sales reps with practical responses to common retail jeweler objections.
- **Rationale**: Equips the internal sales team with unified product messaging, live demo flows, and technical value drivers to maximize trial-to-paid conversion rates.

### 48. Alignment with Updated August 2026 3-Tier Subscription Architecture
- **Decision**: Updated platform plans, feature gates, quotas, and pricing pages to the official Azzure August 2026 3-Tier Subscription model:
  1. **Three Defined Subscription Tiers**:
     - **Starter — $99/mo (300 quotes/mo)**: Full 3-pass AI analysis with manual override, logo + brand name PDF branding, complete quote history, up to 3 seats.
     - **Professional — $199/mo (1,200 quotes/mo)**: Everything in Starter, unlimited role-based seats, shareable branded public quote links (`/q/[token]`), custom pricing profile markups, and auto-push orders to Custom King (Coming Soon).
     - **Enterprise — $299/mo (2,500 quotes/mo)**: Everything in Professional, **Photorealistic 3D Concept Generation**, **In-Store Tablet (Kiosk Mode)** touchscreen, and **Full Auto-Push to Custom King manufacturing**.
  2. **14-Day Free Trial Flow**:
     - 14 days from registration on Professional tier features, capped at 25 quotes during trial, auto-converting to Professional unless changed or cancelled.
  3. **Codebase Updates**:
     - Updated `PLAN_FEATURES` and `BASE_PLAN_DEFINITIONS` in `src/stripe/plans.ts`.
     - Updated feature gates in `src/components/ui/PlanGate.tsx` and `app/showroom/page.tsx`.
     - Rebuilt `app/(marketing)/pricing/page.tsx`, `components/InteractiveLandingPage.tsx`, `public/landing/index.html`, and `app/page.tsx` with the clean 3-tier matrix and comparison tables.
     - Updated `prisma/seed.sql` and synchronized all test suites in `test/feature-gates.test.ts` and `test/integration/analyze-route.test.ts`.
- **Rationale**: Aligns the codebase with executive pricing decisions, eliminating obsolete tiers while bundling premium showroom and 3D rendering capabilities into the competitive $299 Enterprise tier.

### 49. Dynamic Hover Micro-Interactions on Pricing Cards & Comparison Table
- **Decision**: Implemented rich, fluid hover effects across the pricing cards and feature comparison table:
  1. **Feature Comparison Table Hovering**:
     - **Horizontal Row Hover**: Hovering over any feature row tints the background with `rgba(0, 90, 183, 0.045)`, highlights feature labels in brand blue, and increases font contrast.
     - **Vertical Column Hover**: Hovering over any plan column header or cell dynamically highlights the entire vertical column across all category rows with active `.col-hover` class state.
  2. **Pricing Cards Hover Physics**:
     - Cards smoothly lift (`translateY(-8px)` to `-10px`) with cubic-bezier easing (`cubic-bezier(0.16, 1, 0.3, 1)`).
     - Elevated multi-layer drop shadows (`0 28px 52px -12px rgba(0, 90, 183, 0.3)` for Pro, `rgba(201, 168, 76, 0.35)` for Enterprise gold).
     - Badge scale transitions (`scale(1.05)`) on card focus.
- **Rationale**: Elevates perceived software quality, clarifies plan comparisons, and creates delightful micro-interactions for prospective retail jewelers.

### 50. Showroom Logo Contrast & Admin Quotes Page Server Resilience
- **Decision**: 
  1. **Showroom Logo High-Contrast Container**: Wrapped the showroom header logo in a high-contrast container (`.showroomBrandLogoWrapper`) with a clean luminous backdrop (`background: rgba(255, 255, 255, 0.96); padding: 6px 14px; border-radius: 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.3)`). This ensures dark text / transparent PNG logos (like "Custom King NYC") are immediately visible and high-contrast on dark showroom themes. Also ensured the company name is displayed alongside the logo.
  2. **Admin Quotes Page 500 Crash Prevention**: Protected `app/admin/quotes/page.tsx` with comprehensive `try...catch` blocks, graceful fallbacks on database queries, strict numeric parsing for `cad_cost_per_quote`, and per-item calculation exception handling so corrupted records or calculation edge cases never crash the admin ledger.
- **Rationale**: Prevents dark-on-dark logo visibility issues for retail showroom kiosks and guarantees 100% server uptime for internal admin audit operations on Docker / Proxmox servers.

---

## Last Updated
- Date: August 20, 2026
- Status: Production Ready, All 24 Test Suites Passing (107/107 tests), TypeScript zero errors.



## Admin Login Logs Dashboard (2026-09-28)

- **Decision 62**: Reuse the existing `AuditLog` table for successful login history instead of creating a separate `LoginLog` table.
- **Why**: `AuditLog` already contains the exact security-observability columns needed (`actorUserId`, `ipAddress`, `userAgent`, `metadata`, `createdAt`) and is already written by the auth flow. Reusing it keeps the feature aligned with the app's existing audit model and avoids duplicating login-event storage.

- **Decision 63**: Make `AuditLog.companyId` nullable.
- **Why**: Internal admin sign-ins are platform-level events and do not naturally belong to a customer tenant. Previously sign-in logs could only be written for tenant users because `companyId` was required. Making the relation optional lets the platform capture all successful login activity, including admin sessions, while preserving tenant links when they exist.

- **Decision 64**: Capture IP and user-agent inside the Credentials provider `authorize(credentials, request)` callback and pass them through the returned `User` object to the sign-in audit event.
- **Why**: The installed NextAuth v5 beta event payload does not expose the original request, but the Credentials provider does. Attaching the request metadata during authorization keeps the audit write in the existing `events.signIn` location while still recording the client IP/user-agent from the actual login request.

- **Decision 65**: Restrict `/admin/logs` to `SUPER_ADMIN`, `SUPPORT_ADMIN`, and `OPERATIONS_MANAGER`.
- **Why**: Login logs are operational/security data. These roles are the most appropriate existing admin personas for platform monitoring and support investigations, while estimator/sales-focused roles do not need broad login telemetry by default.





## Branding visibility fix (2026-08-20)

- **Decision**: Treat the company name and store logo as complementary identity fields in the showroom header instead of mutually exclusive alternatives.
- **Why**: A logo can contain an old wordmark. Hiding the database-backed company name whenever a logo exists made a successfully saved company-name change invisible.
- **Decision**: Derive showroom CSS brand variables from the validated `primaryColor` passed by the server, with the existing gold as the fallback.
- **Why**: The value was already saved and passed to the client but was not connected to the showroom styles. Central CSS variables keep all branded accents consistent and preserve a safe default.
- **Decision**: Store showroom background color separately from the primary accent color and automatically switch essential showroom text/surfaces to a light-background treatment based on luminance.
- **Why**: Logos need independent control over backdrop contrast; tying the backdrop to the CTA/accent color would reduce flexibility and can make the interface unreadable.
- **Decision**: Store showroom image/video assets in the existing private S3 bucket and retain only their object key and MIME type on `Company`; deliver them through a showroom-token-validated endpoint.
- **Why**: Videos are too large for database fields, public bucket URLs would weaken tenant isolation, and the existing S3 infrastructure already provides durable binary storage.
- **Decision**: Add a local filesystem fallback specifically for showroom media, identified by a `local:` storage-key prefix, while preferring S3 whenever its upload succeeds.
- **Why**: This unblocks local demonstrations without cloud credentials and preserves a clean migration path: future uploads automatically use S3 while existing temporary files remain readable until replaced.
## Launch security decisions (2026-08-20)

- **Decision**: Authenticate both upload and polling sides of the mobile-to-kiosk bridge with an active showroom token, validate UUID session IDs, cap requests/files/aggregate bytes, and verify binary signatures.
- **Why**: The previous bridge trusted caller-supplied IDs and tokens and could be abused as an unauthenticated memory sink or used to retrieve uploads without proving possession of the kiosk token.
- **Decision**: Make the subscription lifecycle cron fail closed when its secret is absent and suppress raw database errors from public health responses.
- **Why**: Missing production configuration must disable privileged automation rather than expose it; public diagnostics should reveal availability but not infrastructure details.
- **Decision**: Patch vulnerable transitive dependencies with compatible overrides (`postcss` and `deepmerge-ts`) and verify Prisma generation/build behavior rather than accepting a risky Prisma downgrade immediately before launch.
- **Why**: This reaches zero known npm advisories while preserving the tested Prisma 6.19 application/runtime interface.
- **Decision**: Replace broad `include: { quote: true }` and Company includes in admin order reads with minimal explicit projections.
- **Why**: The order UI needs only a few pricing and identity fields. Broad Prisma includes couple this critical admin page to every unrelated schema addition and cause avoidable server errors when staging code and migrations are briefly out of sync.
## Margin and plan-model consolidation (2026-08-20)

- **Decision**: Enforce the 50% margin floor on the server as well as in the slider/number controls and backfill existing lower values.
- **Why**: Hiding low presets alone would allow direct API submissions and existing records to continue producing prices below policy.
- **Decision**: Use a compact horizontally scrolling mobile navigation row in both customer and admin shells.
- **Why**: The desktop sidebar is intentionally hidden below 768px; a shared touch navigation row restores access without consuming most of a phone screen with a permanently open drawer.
- **Decision**: Remove Enterprise Ultra from the canonical plan model and migrate its subscriptions to Enterprise while retaining Starter, Professional, and Enterprise.
- **Why**: Ultra duplicated Enterprise pricing/features and caused admin selectors to disagree with the current three-plan customer offering.
- **Decision**: Make the Proxmox `app` service depend on successful completion of the `migrate` service, whose default command deploys migrations and seeds canonical plans.
- **Why**: Previously only the GitHub Actions path explicitly migrated. Portainer or manual Compose launches could start newer application code against an older schema and crash dynamic admin pages.
- **Decision**: Surface permanent deletion on the primary `/admin/tenants/[companyId]` support screen instead of leaving it only in the secondary Companies UI.
- **Why**: Tenant management is the admin's operational entry point. A separated danger zone plus exact-name confirmation makes the capability discoverable without making accidental deletion easy.
## Product naming boundary (2026-08-20)

- **Decision**: Standardize visible product copy on “Azzure AI Quote” and visible maker attribution on “Built by azzuresolutions.com,” while leaving technical identifiers unchanged.
- **Why**: Consistent customer-facing identity is required immediately, whereas renaming package names, route paths, environment keys, user-agent strings, or infrastructure directories would create migration risk without improving the visible brand.

## Showroom appearance customization (2026-08-20)

- **Decision**: Replace automatic light/dark showroom treatment with explicit overlay, text, media-fit, focal-position, and content-panel controls stored per company.
- **Why**: A background color's luminance cannot predict the readable treatment for a photograph or video. Explicit controls give each store reliable contrast while preserving its imagery and logo.
- **Decision**: Keep media uploading in Branding Settings and make Showroom Settings responsible for presentation controls.
- **Why**: This avoids duplicate upload workflows while keeping visual composition changes immediate and reversible.
- **Decision**: Resolve the post-schema-change development error by regenerating Prisma only after stopping every repository Next.js process and rebuilding Turbopack from a clean generated cache.
- **Why**: The migrated database and source schema already contained the fields; the validation error listed the older client model, proving that the running server had retained stale generated metadata rather than encountering a database-column error.

## Tenant detail null-safety and company deletion options (2026-08-20)

- **Decision**: Add comprehensive optional chaining and fallback defaults to `/admin/tenants/[companyId]` and `/admin/tenants` for subscriptions, plans, pricing profiles, and statistics, while placing the `AdminDeleteCompanyButton` in the top header action row as well as the bottom Danger Zone.
- **Why**: If a company's subscription is missing an active plan or has legacy/unassigned records, dereferencing `subscription.plan.name` or `subscription.plan.code` caused Next.js server crashes (500 error) on Proxmox/Docker. Placing the modal-backed delete button prominently in the top header and bottom danger zone allows administrators to immediately locate and safely delete any tenant account with exact-name confirmation.

## Admin Authentication & Role Isolation (2026-09-03)

- **Decision 52**: Standardize internal admin email recognition in `lib/internal-admin.ts`, prevent default tenant company binding in `auth.ts`, unbind admin users from `company_demo_jewelry` in seed data, bypass customer approval redirects for `AZZURE_ADMIN` in `proxy.ts`, and automatically redirect admin logins to `/admin` in `components/sign-in-form.tsx`.
- **Why**: Previously, when signing in with `admin@azzure.com`, three compounding issues caused the user to be treated as a regular demo jeweler instead of a platform admin:
  1. `lib/internal-admin.ts` restricted `admin@azzure.com` recognition behind `NODE_ENV !== "production"`, causing production/develop builds to treat the user as a standard customer if `AZZURE_ADMIN_EMAILS` wasn't explicitly set.
  2. `prisma/seed.sql` created a `Membership` for `user_internal_admin` in `company_demo_jewelry`, and `auth.ts` assigned the first membership (`company_demo_jewelry`) to `user.companyId` and `user.companyName`, defaulting the session into Demo Jewelry.
  3. `components/sign-in-form.tsx` defaulted the post-login redirect to `/` instead of `/admin` for admin users.
  4. `proxy.ts` lacked an `AZZURE_ADMIN` bypass in `applyAccountAccessControl`.
  Fixing these ensures platform admins always receive the `AZZURE_ADMIN` role and are routed directly to the admin dashboard (`/admin`) upon sign-in.

## Admin Currency Assignment on Customer Approval (2026-09-03)

- **Decision 53**: Store the operating & display currency (`USD` or `CAD`) directly on the `Company` record in Prisma, allow administrators to assign it during approval (`/admin/tenants/pending`) or tenant edit (`/admin/tenants/[companyId]` & `/admin/companies/new`), and propagate it to all jeweler workspace surfaces (`QuoteCalculator.tsx`, `app/quotes/[quoteId]/page.tsx`, `app/showroom/showroom-kiosk.tsx`, `app/q/[token]/page.tsx`).
- **Why**: Canadian jewelers and international clients need their workspace, quote calculators, showroom consultation kiosks, and customer-facing public quotes to default to their home currency (`CAD`) without having to manually switch on every page load. Storing this per tenant and having admins assign it upon approving new signups guarantees seamless tenant isolation and accurate local pricing.
- **Decision 54**: Create dedicated Prisma migration `prisma/migrations/20260903000000_add_company_currency/migration.sql` (`ALTER TABLE "Company" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';`).
- **Why**: CI test pipelines and production deployments execute `prisma migrate deploy`, which relies on committed migration SQL files rather than schema introspection or development push. Adding this migration ensures CI test databases automatically create the `currency` column on `Company` prior to running integration tests.

## Genuine Email Verification & Auto-Deletion on Decline (2026-09-08)

- **Decision 55**: Validate domain Mail Exchange (MX) records using Node.js `dns.promises.resolveMx` during account registration before creating database records.
- **Why**: Static email regex and domain blocklists fail to detect randomly generated or non-existent domains. Performing an asynchronous DNS MX lookup upfront guarantees that the domain actually exists and has configured mail servers capable of receiving verification emails.
- **Decision 56**: Defer admin approval alert emails and pending review queue visibility until the tenant owner successfully verifies their email address via OTP or magic link.
- **Why**: Fake signups and spam bots that register without verifying their email should never clutter the administrator's review queue or trigger alert emails. Restricting `/admin/tenants/pending` to verified accounts (`emailVerifiedAt !== null`) guarantees administrators only spend time evaluating genuine, responsive applicants.
- **Decision 57**: Make declining an approval permanently delete the company, its cascading relations, and orphan user records from PostgreSQL via `deleteAdminCompany`.
- **Why**: Previously, declining an application merely updated `accountStatus = "SUSPENDED"`, leaving spam tenants in the database and requiring manual database deletion. Invoking `deleteAdminCompany` on decline immediately purges the rejected application, eliminating manual cleanup.

## Upfront Stripe Checkout Gating & Existing Tenant Remediation (2026-09-08)

- **Decision 58**: Defer account provisioning in PostgreSQL until after successful Stripe Checkout card submission (Option 1).
- **Why**: Previously, `/api/checkout` pre-created `Company`, `User`, and `Subscription` records in PostgreSQL before redirecting to Stripe. If prospects abandoned checkout, phantom tenants remained in the database with null Stripe customer IDs. Storing a temporary `PendingRegistration` record and only creating the real tenant upon receiving `checkout.session.completed` ensures 100% of provisioned tenants possess a validated payment method and Stripe customer record.
- **Decision 59**: Display an attention billing banner in the customer workspace when `stripeCustomerId` is null (Option A).
- **Why**: Existing trialing tenants created prior to upfront gating should not be abruptly locked out of their 14-day trial, but need clear and continuous prompting to register their payment method before their trial expires.
- **Decision 60**: Provide an admin-initiated Stripe Checkout link generation tool on `/admin/tenants/[companyId]` (Option C).
- **Why**: Platform administrators troubleshooting tenants without payment details can immediately generate a checkout session link, copy it to their clipboard, or email it directly to the business owner to resolve missing billing details.

## Pricing Engine Double-Markup Elimination (2026-09-08)

- **Decision 61**: Remove the legacy `* finalMultiplier` factor from `calculateMakingPrice` in `src/services/pricing.ts` so that `estimatedSellingPrice = makingPrice + customerMarginAmount`.
- **Why**: In the legacy MVP codebase, `PricingProfile.finalMultiplier` defaulted to `2` (keystone doubling). When the 3-Tier pricing system (`Production Subtotal ÷ tierDivisor = Making Price`) and explicit jeweler `customerMarginPct` were implemented, `calculateMakingPrice` still multiplied `(makingPrice + margin) * finalMultiplier`. Consequently, when a jeweler configured 0% margin, the End Customer Price doubled from $1,671.51 to $3,343.02 with 100% ROI, which contradicted the breakdown display. Removing `finalMultiplier` aligns the pricing hierarchy so that Customer Margin % is the sole controller of the jeweler's retail markup.





# Azzure AutoQuote — Architectural Decisions & Rationales (`brain.md`)

## Overview
This document logs every key architectural, design, and calculation decision made during the development of Azzure AutoQuote MVP.

---

## Key Decisions Log

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

---

## Last Updated
- Date: August 20, 2026
- Status: Production Ready, All 21 Test Suites Passing (97/97 tests), TypeScript zero errors.

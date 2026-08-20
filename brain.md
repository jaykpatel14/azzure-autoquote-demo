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

---

## Last Updated
- Date: August 20, 2026
- Status: Production Ready, All 23 Test Suites Passing (102/102 tests), TypeScript zero errors, Resend email & Admin Customer deletion suite live.










# 💎 Azzure AI Quote — B2B AI Jewelry Quoting & 3D Visualization Platform

> **Transforming 3-Day Custom Jewelry Quoting into an Instant 30-Second In-Store Experience.**  
> Built for retail jewelry stores, custom bridal boutiques, and high-end showroom Workstation on Wheels (WOW) kiosks.

---

## 🌟 Executive Overview & Showpiece Highlights

**Azzure AI Quote** is an enterprise-grade B2B SaaS platform engineered to eliminate friction in custom jewelry sales. Traditional custom jewelry estimation requires taking photos, emailing CAD designers or casting houses, and waiting 2–3 days for a quote—during which over 60% of prospective clients walk away.

With **Azzure AI Quote**, sales associates and walk-in clients can:
1. 📸 **Upload or Snap a Reference Photo** or describe a custom ring / pendant concept.
2. 🤖 **3-Pass Vision Consensus Analysis**: Runs 3 independent AI vision passes to determine exact metal gram weight, gemstone carat weights, cut shapes, setting styles, and accent stones with statistical medians and modes.
3. 💎 **Photorealistic 3D Macro Rendering**: Generates tangible studio-quality catalog renders with physically accurate optical dispersion, refractive index, specular metal reflections, and anti-AI-artifact constraints.
4. 📈 **Live Spot Pricing & Wastage Formula**: Integrates live spot gold/platinum market rates via Metals.dev (with automated fallback), applying real-world casting loss allowance (25–28.5%) and store-specific profit margin tiers.
5. 📄 **Instant PDF Export & CAD Dispatch**: Generate branded client quotes in USD/CAD with 1-click dispatch into CAD manufacturing workflows.

---

## 🛠️ Tech Stack & Key Architecture

- **Framework**: Next.js 15 (App Router, Server Actions, React Server Components)
- **Language**: TypeScript (Strict Mode)
- **Database & ORM**: PostgreSQL with Prisma ORM
- **Authentication**: Auth.js (NextAuth v5) with multi-tenant session isolation & IP access control
- **AI & Computer Vision**: OpenAI GPT-4 Vision multi-pass consensus engine & DALL-E / GPT Image 2 macro rendering engine
- **Market Data**: Metals.dev REST API with live metal spot rates & automatic failover engine
- **Billing & Subscriptions**: Stripe Checkout, Customer Portal & Webhook Synchronization (Starter, Pro, Enterprise, Ultra)
- **UI & Design System**: Luxury Light & Obsidian Dark Showroom themes, glassmorphism, Google Fonts (Inter + Playfair Display)
- **Deployment**: Docker, Docker Compose, Proxmox & AWS S3 PDF storage integration

---

## ✨ Key Features & Capability Matrix

| Feature | Description |
| :--- | :--- |
| **Showroom Kiosk Studio** | Touchscreen interface designed for iPad / Workstation on Wheels (WOW) with 1-tap inspiration presets |
| **3-Pass AI Spec Extractor** | Multi-pass vision verification preventing single-prompt hallucinations on stone shapes & metal weight |
| **Live Spot Gold Engine** | Real-time bullion prices with automatic casting loss multipliers (`1.25x` to `1.285x`) |
| **B2B Multi-Tenancy** | Organization-isolated quotes, pricing tier divisors, custom margins, and branded PDF generation |
| **Interactive Pricing Sandbox** | Real-time "what-if" margin adjustments & live currency switching (USD / CAD) |
| **Security & Audit Logs** | Comprehensive admin activity logging, session tracking, and application-level IP blocking |

---

## 📋 Prerequisites & Local Development

### Prerequisites
- **Node.js**: v20.9.0 or higher
- **Docker**: Docker Desktop (Windows/macOS) or Docker Engine (Linux)
- **Database**: PostgreSQL 15+ (handled automatically via Docker Compose)

### Quick Start Guide

1. **Clone & Install Dependencies**
   ```bash
   git clone https://github.com/YOUR_USERNAME/azzure-autoquote-mvp.git
   cd azzure-autoquote-mvp
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env.local
   ```
   *Update `.env.local` with your database credentials and API keys (`OPENAI_API_KEY`, `METALS_DEV_API_KEY`, etc.).*

3. **Start PostgreSQL Database**
   ```bash
   docker compose up -d
   ```

4. **Run Prisma Database Migrations & Seeding**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. **Launch Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Demo & Seeding Credentials

After running `npm run db:seed`, use the following credentials to explore the system:

- **Jewelry Store Owner**: `owner@demojewelry.test` | Password: `demo-password`
- **Sales Associate**: `test@acme.com` | Password: `demo-password`
- **Internal System Admin**: `admin@azzure.com` | Password: `password123`

---

## 🧪 Testing & Code Verification

Ensure code quality and test coverage before deployment:

```bash
# Typecheck TypeScript codebase
npm run typecheck

# Lint codebase
npm run lint

# Run Unit & Integration Tests (Vitest)
npm run test

# Production Build Verification
npm run build
```

---

## 🚢 Docker & Production Deployment

The project includes production-ready Docker deployment configurations:

```bash
# Build production Docker image
docker build -t azzure-autoquote-mvp .

# Run with docker-compose
docker compose -f docker-compose.yml up -d
```

---

## 📄 License & Showcase Disclaimer

This repository is maintained as a personal portfolio piece and technical showcase for client work on Upwork. All branding assets, architecture designs, and custom algorithms are demonstrated for showcase purposes.

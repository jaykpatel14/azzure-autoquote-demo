import Link from "next/link";
import { redirect } from "next/navigation";
import TrialBanner from "@/components/trial-banner";
import TrialSidebarStatus from "@/components/trial-sidebar-status";
import { PlanGate } from "@/src/components/ui/PlanGate";
import WorkspaceShell from "@/components/workspace-shell";
import { UsageBar } from "@/src/components/ui/UsageBar";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { getTrialDaysRemaining, getTrialQuotesRemaining } from "@/lib/billing";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getWorkspaceNav } from "@/lib/workspace-nav";
import { getDashboardData } from "@/src/services/dashboard";
import { getFeaturesForPlan, resolvePlanId } from "@/src/stripe/plans";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function formatRelativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  if (diffMinutes < 60) return `${Math.max(1, diffMinutes)}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getBarFrame(count: number, maxCount: number, index: number, total: number) {
  const width = 1000 / total - 2;
  const height = 160;
  const safeMax = Math.max(maxCount, 1);
  const barHeight = Math.max((count / safeMax) * height, count > 0 ? 4 : 1);
  return {
    x: index * (width + 2),
    y: height - barHeight,
    width,
    height: barHeight
  };
}

function DashboardChart({ data }: { data: Array<{ date: Date; label: string; count: number }> }) {
  const maxCount = Math.max(...data.map((point) => point.count), 1);

  return (
    <div className="chartShell">
      <svg viewBox="0 0 1000 200" role="img" aria-label="Quotes created in the last 30 days">
        <line x1="0" y1="160" x2="1000" y2="160" stroke="var(--color-outline-variant)" />
        {data.map((point, index) => {
          const frame = getBarFrame(point.count, maxCount, index, data.length);
          const showLabel = index % 5 === 0 || index === data.length - 1;

          return (
            <g key={point.label}>
              <rect x={frame.x} y={frame.y} width={frame.width} height={frame.height} rx="4" fill="rgba(0, 90, 183, 0.6)">
                <title>{`${point.label}: ${point.count}`}</title>
              </rect>
              {showLabel ? (
                <text x={frame.x} y="184" fill="var(--color-outline)" fontSize="10">
                  {point.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="chartMeta">
        <span className="muted small">30 days of quote activity</span>
        <span className="muted small">
          Highest day: {maxCount} quote{maxCount === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

const FEATURE_STEPS = [
  {
    step: "01",
    title: "Drop in the image",
    description: "Upload a jewelry photo and the system queues a moderated image analysis."
  },
  {
    step: "02",
    title: "Review the draft",
    description: "Metal weight, stone assumptions, and pricing overlays stay editable before approval."
  },
  {
    step: "03",
    title: "Send the quote",
    description: "Save the approved price, export the PDF, and share a customer-safe preview."
  }
] as const;

const MARKETING_STATS = [
  {
    label: "AI-assisted pass",
    value: "3-stage review",
    detail: "Moderation, extraction, and pricing checks run before the estimate is saved."
  },
  {
    label: "Pricing source",
    value: "Live metals feed",
    detail: "When available, live spot pricing keeps previews grounded in current market data."
  },
  {
    label: "Quote surface",
    value: "Customer-safe",
    detail: "Public views show only the approved final price and high-level quote details."
  },
  {
    label: "Brand tone",
    value: "Editorial luxury",
    detail: "Typography, spacing, and motion are tuned to feel elevated instead of generic."
  }
] as const;

const PLAN_CARDS = [
  {
    name: "Starter",
    price: "$49",
    period: "/ month",
    badge: null,
    audience: "Solo jewelers & occasional quoting",
    cta: "Start free trial",
    ctaHref: "/signup?plan=starter",
    featured: false,
    features: [
      "100 quotes / month",
      "1-pass AI estimate",
      "Fixed pricing profile",
      "1-page PDF with Azzure watermark",
      "1 seat",
      "Standard email support"
    ]
  },
  {
    name: "Professional",
    price: "$99",
    period: "/ month",
    badge: "Most Popular",
    audience: "Growing shops quoting every day",
    cta: "Start free trial",
    ctaHref: "/signup?plan=professional",
    featured: true,
    features: [
      "500 quotes / month",
      "Full 3-pass AI analysis",
      "Editable pricing profile & margins",
      "Custom branded PDFs",
      "Full quote & image history",
      "Up to 5 seats"
    ]
  },
  {
    name: "Enterprise",
    price: "$199",
    period: "/ month",
    badge: null,
    audience: "High-volume & multi-location jewelers",
    cta: "Contact Sales",
    ctaHref: "mailto:sales@azzureautoquote.com",
    featured: false,
    features: [
      "2,500 quotes / month",
      "3-pass AI + manual override",
      "White-label PDF templates",
      "Unlimited role-based seats",
      "Manufacturing orders [Staging]",
      "Branded customer quote links"
    ]
  },
  {
    name: "Ultra",
    price: "$399",
    period: "/ month",
    badge: "Flagship Studio",
    audience: "Showrooms, tablet WOW kiosks & luxury studios",
    cta: "Start free trial",
    ctaHref: "/signup?plan=ultra",
    featured: false,
    features: [
      "10,000 quotes / month",
      "Photorealistic 3D Concept Generation",
      "In-Store Tablet / WOW Showroom Mode",
      "Store Logo & Showroom Assets",
      "Manufacturing order dispatch",
      "24/7 Dedicated Concierge"
    ]
  }
] as const;

export default async function HomePage() {
  const adminContext = await getInternalAdminContext();
  if (adminContext) {
    redirect("/admin");
  }

  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    return <MarketingPage />;
  }

  if (context.company.subscription && !context.company.subscription.onboardingComplete) {
    redirect("/onboarding");
  }

  const dashboard = await getDashboardData(context.company.id);

  const subscription = context.company.subscription;
  const trialDaysRemaining = getTrialDaysRemaining(subscription);
  const trialQuotesRemaining = getTrialQuotesRemaining(subscription);
  const planFeatures = subscription ? getFeaturesForPlan(resolvePlanId(subscription.plan, subscription.status)) : null;

  return (
    <WorkspaceShell
      title="Workspace overview"
      description="Track quotes and jump into the next action without leaving the dashboard."
      navItems={getWorkspaceNav("/")}
      banner={
        subscription?.status === "TRIALING" &&
        trialDaysRemaining !== null &&
        trialQuotesRemaining !== null ? (
          <TrialBanner
            companyId={context.company.id}
            daysRemaining={trialDaysRemaining}
            quoteCap={subscription.trialQuoteCap}
            quotesRemaining={trialQuotesRemaining}
          />
        ) : null
      }
      sidebarExtra={
        subscription?.status === "TRIALING" &&
        trialDaysRemaining !== null &&
        trialQuotesRemaining !== null ? (
          <TrialSidebarStatus
            daysRemaining={trialDaysRemaining}
            quoteCap={subscription.trialQuoteCap}
            quotesRemaining={trialQuotesRemaining}
            urgent={trialDaysRemaining <= 3}
          />
        ) : null
      }
      actions={
        <>
          <Link className="button primary" href="/quotes/new">
            New estimate
          </Link>
          <Link className="button secondary" href="/quotes">
            Quote history
          </Link>
          <Link className="button secondary" href="/settings/billing">
            Subscription billing
          </Link>
        </>
      }
    >
      {/* KPI Stats Grid */}
      <section className="statGrid" aria-label="Business snapshot" style={{ marginBottom: 32 }}>
        <article className="statCard statCard--usage">
          <span className="eyebrow">Quotes this month</span>
          <strong>{dashboard.usage?.used ?? 0}</strong>
          <UsageBar
            used={(dashboard.usage?.used ?? 0) + (dashboard.usage?.reserved ?? 0)}
            total={dashboard.usage?.limit ?? 1}
            label={`of ${dashboard.usage?.limit ?? 0} available`}
          />
        </article>
        <article className="statCard">
          <span className="eyebrow">Total quotes all time</span>
          <strong>{dashboard.totalQuotes}</strong>
          <p className="muted small">{dashboard.quotesThisMonth} this month</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Pending orders</span>
          <strong>{dashboard.pendingOrders}</strong>
          <p className="muted small">
            {planFeatures?.canPlaceManufacturingOrder ? "No orders in production yet" : "Upgrade for orders"}
          </p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Quotes sent to customers</span>
          <strong>{dashboard.quotesSentThisMonth}</strong>
          <p className="muted small">PDFs generated this month</p>
        </article>
      </section>

      <section className="grid twoUp">
        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Quote activity</h2>
              <p className="muted">A 30-day view of how many quotes were created each day.</p>
            </div>
          </div>
          {dashboard.totalQuotes === 0 ? (
            <div className="emptyState emptyStateIllustrated">
              <QuoteOutlineIllustration />
              <strong>Welcome to Azzure AutoQuote. Upload a jewelry photo or describe a concept to generate a quote in seconds.</strong>
              <p className="muted">Create your first quote and this chart will begin to fill in.</p>
              <Link className="button primary" href="/quotes/new">
                New quote
              </Link>
            </div>
          ) : (
            <DashboardChart data={dashboard.quoteActivity} />
          )}
        </article>

        <article className="card accentCard">
          <div className="sectionHeader">
            <div>
              <h2>Quick actions</h2>
              <p className="muted">The three actions jewelers use most are right here.</p>
            </div>
          </div>
          <div className="stack">
            <Link className="detailCard" href="/quotes/new">
              <span>New quote</span>
              <strong>Upload a photo to start</strong>
              <p className="muted small">Open the quote builder and start a new estimate.</p>
            </Link>
            <PlanGate feature="canShareQuoteLink" fallbackHref="/settings/billing?upgrade=1">
              <Link className="detailCard" href="/quotes?status=sent">
                <span>Share a quote</span>
                <strong>Send a quote to your customer</strong>
                <p className="muted small">Open your sent quotes and copy the public link.</p>
              </Link>
            </PlanGate>
            <PlanGate feature="canPlaceManufacturingOrder" fallbackHref="/settings/billing?upgrade=1">
              <PlanGate requireCkVerification fallbackHref="/settings/billing?upgrade=1">
                <Link className="detailCard" href="/orders">
                  <span>Place an order</span>
                  <strong>Submit for manufacturing</strong>
                  <p className="muted small">Open the manufacturing workspace.</p>
                </Link>
              </PlanGate>
            </PlanGate>
          </div>
        </article>
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <div className="sectionHeader">
          <div>
            <h2>Recent quotes</h2>
            <p className="muted">Last five quotes, newest first.</p>
          </div>
          <Link href="/quotes" className="textLink">
            View all quotes
          </Link>
        </div>
        {dashboard.recentQuotes.length === 0 ? (
          <div className="emptyState emptyStateIllustrated">
            <QuoteOutlineIllustration />
            <strong>Welcome to Azzure AutoQuote. Upload a jewelry photo or describe a concept to generate a quote in seconds.</strong>
            <p className="muted">Your latest five quotes will appear here once you save your first estimate.</p>
            <Link className="button primary" href="/quotes/new">
              New quote
            </Link>
          </div>
        ) : (
          <div className="tableShell">
            <table className="dataTable dashboardQuotesTable">
              <thead>
                <tr>
                  <th scope="col">Thumbnail</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Metal</th>
                  <th scope="col">Quote price</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recentQuotes.map((quote) => (
                  <tr key={quote.id}>
                    <td>
                      <Link className="quoteThumbLink" href={`/quotes/${quote.id}`}>
                        {quote.thumbnailUrl ? (
                          <img className="quoteThumbnail" src={quote.thumbnailUrl} alt={`${quote.metalType} jewelry for quote ${quote.quoteNumber}`} />
                        ) : (
                          <div className="quoteThumbnail quoteThumbnail--fallback">
                            <span>{quote.quoteNumber.slice(-2)}</span>
                          </div>
                        )}
                      </Link>
                    </td>
                    <td>
                      <Link className="quoteTitleLink" href={`/quotes/${quote.id}`}>
                        <strong>{quote.customerName || "Unassigned"}</strong>
                      </Link>
                      <p className="muted small">
                        {quote.quoteNumber} · {formatRelativeTime(quote.createdAt)}
                      </p>
                    </td>
                    <td>{quote.metalType}</td>
                    <td className="quoteValue">
                      {quote.estimatedPrice === null ? "Not generated" : formatCurrency(quote.estimatedPrice)}
                    </td>
                    <td>
                      <StatusBadge status={quote.status} />
                    </td>
                    <td>
                      <div className="quoteActionsInline">
                        <Link className="textLink" href={`/quotes/${quote.id}`}>
                          View
                        </Link>
                        <Link className="textLink" href={`/api/quotes/${quote.id}/pdf`} target="_blank">
                          PDF
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid twoUp" style={{ marginTop: 24 }}>
        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Recent orders</h2>
              <p className="muted">Enterprise-only manufacturing orders will show up here once enabled.</p>
            </div>
          </div>
          {planFeatures?.canPlaceManufacturingOrder ? (
            dashboard.recentOrders.length === 0 ? (
              <div className="emptyState">
                <strong>No orders submitted yet</strong>
                <p className="muted">Place your first manufacturing order from any finalized quote.</p>
                <Link className="button primary button--sm" href="/quotes">
                  View quotes
                </Link>
              </div>
            ) : (
              <div className="compactList">
                {dashboard.recentOrders.map((order) => (
                  <div key={order.id} className="compactRow">
                    <div>
                      <strong>{order.orderNumber}</strong>
                      <p className="muted small">
                        {order.quoteNumber} · {order.itemName}
                      </p>
                    </div>
                    <div>
                      <StatusBadge status={order.status} />
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="emptyState">
              <strong>Upgrade for orders</strong>
              <p className="muted">The manufacturing workflow is reserved for Enterprise accounts.</p>
              <Link className="button secondary button--sm" href="/settings/billing?upgrade=1">
                Review plans
              </Link>
            </div>
          )}
        </article>

        <article className="card accentCard">
          <div className="sectionHeader">
            <div>
              <h2>Pricing is handled automatically</h2>
              <p className="muted">Customers see the approved selling price while internal cost inputs stay private.</p>
            </div>
          </div>
        </article>
      </section>
    </WorkspaceShell>
  );
}

function QuoteOutlineIllustration() {
  return (
    <svg className="emptyStateIllustration" viewBox="0 0 240 120" role="img" aria-label="Jewelry outline illustration">
      <path
        d="M64 56c12-16 30-24 56-24s44 8 56 24c-12 16-30 24-56 24s-44-8-56-24Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M103 58l17-20 17 20-17 26-17-26Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M52 76h136" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MarketingPage() {
  return (
    <main className="marketingPage">
      {/* Top Navigation */}
      <header style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(249, 249, 255, 0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--color-outline-variant)",
        boxShadow: "0 1px 4px rgba(26,28,35,0.04)"
      }}>
        <div style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "0 48px",
          height: 80,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="font-headline-lg" style={{ color: "var(--color-primary)", fontFamily: "var(--font-display)", fontSize: "1.75rem", fontWeight: 600 }}>Azzure</span>
            <span className="muted small" style={{ marginTop: 2 }}>AutoQuote AI</span>
          </div>
          <nav style={{ display: "flex", alignItems: "center", gap: 48 }}>
            <a href="#workflow" style={{ color: "var(--color-secondary)", fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none" }}>Workflow</a>
            <a href="#pricing" style={{ color: "var(--color-secondary)", fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none" }}>Pricing</a>
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <Link href="/signin" style={{ color: "var(--color-primary)", fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none" }}>
              Log In
            </Link>
            <Link className="button primary" href="/pricing">
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="marketingHero" id="home">
        <div className="marketingHeroInner">
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "40px", maxWidth: 640 }}>
            {/* AI badge */}
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 16px 6px 10px",
              background: "var(--color-surface-container-low)",
              border: "1px solid var(--color-outline-variant)",
              borderRadius: "var(--radius-full)",
              width: "fit-content"
            }}>
              <span style={{
                width: 8, height: 8,
                borderRadius: "50%",
                background: "var(--color-primary)",
                animation: "pulse-glow 2s infinite",
                display: "inline-block"
              }} />
              <span className="font-label-sm" style={{ color: "var(--color-primary)" }}>Introducing AutoQuote v2.0</span>
            </div>

            <h1 className="marketingHeadline">
              Stop Saying<br />
              <em>&ldquo;Let Me Get Back to You.&rdquo;</em>
            </h1>

            <p className="marketingSubheadline">
              The ultimate AI-powered pricing engine for luxury jewelry retailers. Close bespoke commissions instantly on the showroom floor with real-time, mathematically perfect quotes.
            </p>

            <div className="marketingActions">
              <Link className="button primary button--lg" href="/pricing">
                Start Free Trial
                <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">arrow_forward</span>
              </Link>
              <Link className="button secondary button--lg" href="/signin">
                Sign In
              </Link>
            </div>

            {/* Trust indicators */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, paddingTop: 24, borderTop: "1px solid var(--color-surface-variant)" }}>
              <div>
                <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.125rem", color: "var(--color-on-surface)", margin: "0 0 2px" }}>Trusted by 500+</p>
                <p className="muted small" style={{ margin: 0 }}>luxury retailers worldwide</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <section style={{ background: "var(--color-surface-container-low)", padding: "60px 48px", borderTop: "1px solid var(--color-outline-variant)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div className="statGrid">
            {MARKETING_STATS.map((item) => (
              <article key={item.label} className="statCard">
                <span className="eyebrow">{item.label}</span>
                <strong style={{ fontSize: "1.25rem" }}>{item.value}</strong>
                <p className="muted small">{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="marketingSection" id="workflow">
        <div className="sectionHeader" style={{ maxWidth: 1280, margin: "0 auto 48px" }}>
          <div>
            <p className="eyebrow">Workflow</p>
            <h2 className="heading">A calm, three-step path from image upload to approved price.</h2>
          </div>
        </div>
        <div className="featureSteps">
          {FEATURE_STEPS.map((item) => (
            <article key={item.step} className="featureStep" data-step={item.step}>
              <h3>{item.title}</h3>
              <p className="muted">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section className="marketingSection" id="pricing" style={{ background: "var(--color-surface-container-low)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div className="sectionHeader" style={{ marginBottom: 40 }}>
            <div>
              <p className="eyebrow" style={{ color: "var(--color-primary)" }}>Plans &amp; Pricing</p>
              <h2 className="heading">Simple pricing that scales with your quoting volume</h2>
              <p className="muted" style={{ marginTop: 8, fontSize: "1.05rem" }}>
                Start with a 14-day free trial on any plan. Upgrade, downgrade, or cancel anytime.
              </p>
            </div>
          </div>

          <div className="pricingCards">
            {PLAN_CARDS.map((plan) => (
              <article key={plan.name} className={plan.featured ? "pricingCard pricingCard--featured" : "pricingCard"}>
                {plan.badge ? <span className="pricingBadge">{plan.badge}</span> : null}
                <div>
                  <div className="pricingCardTop">
                    <p className="pricingTrial">14-Day Free Trial</p>
                    <h3 className="pricingCardName">{plan.name}</h3>
                    <div className="pricingCardPrice">
                      {plan.price} <span>{plan.period}</span>
                    </div>
                    <p className="muted small">{plan.audience}</p>
                  </div>

                  <ul className="pricingFeatureList" aria-label={`${plan.name} features`}>
                    {plan.features.map((feature: string) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  {plan.ctaHref.startsWith("mailto:") ? (
                    <a
                      className={plan.featured ? "button primary button--lg" : "button secondary button--lg"}
                      style={{ width: "100%" }}
                      href={plan.ctaHref}
                    >
                      {plan.cta}
                    </a>
                  ) : (
                    <Link
                      className={plan.featured ? "button primary button--lg" : "button secondary button--lg"}
                      style={{ width: "100%" }}
                      href={plan.ctaHref}
                    >
                      {plan.cta}
                    </Link>
                  )}
                  <p className="pricingFootnote" style={{ marginTop: 12 }}>
                    14-day free trial · Card required · Cancel anytime
                  </p>
                </div>
              </article>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: 48 }}>
            <Link className="button secondary button--lg" href="/pricing" style={{ padding: "14px 28px", fontSize: "1rem" }}>
              Compare Full Feature Table &amp; FAQs
              <span className="material-symbols-outlined" style={{ fontSize: 18, marginLeft: 8 }} aria-hidden="true">arrow_forward</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

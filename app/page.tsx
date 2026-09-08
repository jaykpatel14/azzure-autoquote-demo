import Link from "next/link";
import { redirect } from "next/navigation";
import TrialBanner from "@/components/trial-banner";
import TrialSidebarStatus from "@/components/trial-sidebar-status";
import { PlanGate } from "@/src/components/ui/PlanGate";
import WorkspaceShell from "@/components/workspace-shell";
import { UsageBar } from "@/src/components/ui/UsageBar";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { getTrialDaysRemaining, getTrialQuotesRemaining } from "@/lib/billing";
import { cookies } from "next/headers";
import { ACTIVE_COMPANY_COOKIE, CompanyAccessError, getAuthenticatedCompanyContext } from "@/lib/company";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getWorkspaceNav } from "@/lib/workspace-nav";
import { getDashboardData } from "@/src/services/dashboard";
import { getFeaturesForPlan, resolvePlanId } from "@/src/stripe/plans";
import { InteractiveLandingPage } from "@/components/InteractiveLandingPage";
import { resolveMetalPricing } from "@/lib/metal-pricing";

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
    price: "$99",
    period: "/ month",
    badge: null,
    audience: "Solo jewelers & boutique studios",
    cta: "Start free trial",
    ctaHref: "/signup?plan=starter",
    featured: false,
    features: [
      "300 quotes / month",
      "Full 3-pass AI + manual override",
      "Branded PDFs (Logo + brand name)",
      "Complete quote history",
      "Up to 3 seats",
      "Live precious metal spot pricing"
    ]
  },
  {
    name: "Professional",
    price: "$199",
    period: "/ month",
    badge: "Most Popular · 14-Day Trial",
    audience: "Growing shops quoting every day",
    cta: "Start free trial",
    ctaHref: "/signup?plan=professional",
    featured: true,
    features: [
      "1,200 quotes / month",
      "Everything in Starter",
      "Unlimited seats + role-based access",
      "Shareable branded quote links",
      "Custom pricing profile & markups",
      "Auto-push to Custom King (Coming Soon)"
    ]
  },
  {
    name: "Enterprise",
    price: "$299",
    period: "/ month",
    badge: "Flagship Studio",
    audience: "Showrooms, tablet kiosks & high-volume retailers",
    cta: "Start free trial",
    ctaHref: "/signup?plan=enterprise",
    featured: false,
    features: [
      "2,500 quotes / month",
      "Everything in Professional",
      "Photorealistic 3D Concept Renders",
      "In-Store Tablet (Kiosk Mode)",
      "Full Auto-Push to Custom King",
      "Store logo & custom showroom branding"
    ]
  }
] as const;

export default async function HomePage() {
  const adminContext = await getInternalAdminContext();

  // When an internal admin navigates to the root dashboard, redirect to the admin console
  // (or sales dashboard for sales users) unless they are explicitly impersonating/previewing a tenant company via cookie.
  if (adminContext) {
    const cookieStore = await cookies();
    const cookieCompanyId = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value;
    if (!cookieCompanyId) {
      if (adminContext.user.adminRole === "SALESMAN") {
        redirect("/admin/sales");
      }
      redirect("/admin");
    }
  }

  let context;
  try {
    context = await getAuthenticatedCompanyContext();
  } catch (error) {
    // Internal admins have no company membership of their own. Unless they've opened
    // a tenant's context from the admin console (handled inside getAuthenticatedCompanyContext),
    // send them back to the admin console instead of surfacing this as an error.
    if (adminContext && error instanceof CompanyAccessError) {
      if (adminContext.user.adminRole === "SALESMAN") {
        redirect("/admin/sales");
      }
      redirect("/admin");
    }
    throw error;
  }

  if (!context) {
    if (adminContext) {
      if (adminContext.user.adminRole === "SALESMAN") {
        redirect("/admin/sales");
      }
      redirect("/admin");
    }
    return <MarketingPage />;
  }

  if (context.company.subscription && !context.company.subscription.onboardingComplete) {
    redirect("/onboarding");
  }

  const [dashboard, livePricing] = await Promise.all([
    getDashboardData(context.company.id),
    resolveMetalPricing()
  ]);

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
            hasPaymentMethod={Boolean(subscription.stripeCustomerId)}
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
              <strong>Welcome to Azzure AI Quote. Upload a jewelry photo or describe a concept to generate a quote in seconds.</strong>
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
            <strong>Welcome to Azzure AI Quote. Upload a jewelry photo or describe a concept to generate a quote in seconds.</strong>
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
                        <Link className="textLink" href={`/q/${quote.id}`} target="_blank" rel="noopener noreferrer" title="Customer View">
                          Customer View ↗
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

      <section className="card" style={{ marginTop: 24 }}>
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
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <div className="sectionHeader">
          <div>
            <h2>Live precious metal pricing</h2>
            <p className="muted">
              {livePricing.source !== "configured-default"
                ? "Auto-refreshed daily and used in every new quote's metal cost."
                : "Live feed unavailable right now — quotes are using the configured fallback pricing below."}
            </p>
          </div>
        </div>
        <div className="pricingGrid">
            <div className="detailCard" style={{ borderLeft: "3px solid #f59e0b" }}>
              <span className="eyebrow" style={{ color: "#d97706" }}>XAU · Gold</span>
              <strong style={{ fontSize: "1.5rem", fontFamily: "var(--font-display, Georgia, serif)" }}>
                ${Number(livePricing.pricingProfile.goldSpotPerOz).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                <span style={{ fontSize: "0.875rem", fontWeight: 400, color: "var(--color-on-surface-variant)" }}> / oz</span>
              </strong>
              <p className="muted small" style={{ marginTop: 4 }}>
                14K: ~${(Number(livePricing.pricingProfile.goldSpotPerOz) / 31.1035 * 0.585).toFixed(2)}/g
              </p>
            </div>

            <div className="detailCard" style={{ borderLeft: "3px solid #94a3b8" }}>
              <span className="eyebrow" style={{ color: "#64748b" }}>XPT · Platinum</span>
              <strong style={{ fontSize: "1.5rem", fontFamily: "var(--font-display, Georgia, serif)" }}>
                ${Number(livePricing.pricingProfile.platinumSpotPerOz).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                <span style={{ fontSize: "0.875rem", fontWeight: 400, color: "var(--color-on-surface-variant)" }}> / oz</span>
              </strong>
              <p className="muted small" style={{ marginTop: 4 }}>
                950 Plat: ~${(Number(livePricing.pricingProfile.platinumSpotPerOz) / 31.1035).toFixed(2)}/g
              </p>
            </div>

            <div className="detailCard" style={{ borderLeft: "3px solid #cbd5e1" }}>
              <span className="eyebrow" style={{ color: "#64748b" }}>XAG · Silver</span>
              <strong style={{ fontSize: "1.5rem", fontFamily: "var(--font-display, Georgia, serif)" }}>
                ${Number(livePricing.pricingProfile.silverSpotPerOz).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                <span style={{ fontSize: "0.875rem", fontWeight: 400, color: "var(--color-on-surface-variant)" }}> / oz</span>
              </strong>
              <p className="muted small" style={{ marginTop: 4 }}>
                925 Silver: ~${(Number(livePricing.pricingProfile.silverSpotPerOz) / 31.1035).toFixed(2)}/g
              </p>
            </div>

            <div className="detailCard" style={{ borderLeft: "3px solid #0284c7" }}>
              <span className="eyebrow" style={{ color: "#0284c7" }}>Feed status</span>
              <strong style={{ fontSize: "1.125rem" }}>
                {livePricing.source !== "configured-default" ? "🟢 Live" : "🟡 Fallback"}
              </strong>
              <p className="muted small" style={{ marginTop: 4 }}>
                {livePricing.message || "Daily spot rate auto-refreshed."}
              </p>
            </div>
          </div>
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
  return <InteractiveLandingPage />;
}

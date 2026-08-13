import Link from "next/link";
import { redirect } from "next/navigation";
import TrialBanner from "@/components/trial-banner";
import TrialSidebarStatus from "@/components/trial-sidebar-status";
import WorkspaceShell from "@/components/workspace-shell";
import { UsageBar } from "@/src/components/ui/UsageBar";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { getTrialDaysRemaining, getTrialQuotesRemaining } from "@/lib/billing";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getWorkspaceNav } from "@/lib/workspace-nav";
import { normalizePricingProfile, resolveMetalPricing } from "@/lib/metal-pricing";
import { getDashboardData } from "@/src/services/dashboard";
import { getQuotePublicUrl } from "@/src/services/quotes";

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
        <line x1="0" y1="160" x2="1000" y2="160" stroke="rgba(255,255,255,0.08)" />
        {data.map((point, index) => {
          const frame = getBarFrame(point.count, maxCount, index, data.length);
          const showLabel = index % 5 === 0 || index === data.length - 1;

          return (
            <g key={point.label}>
              <rect x={frame.x} y={frame.y} width={frame.width} height={frame.height} rx="4" fill="rgba(201,168,76,0.6)">
                <title>{`${point.label}: ${point.count}`}</title>
              </rect>
              {showLabel ? (
                <text x={frame.x} y="184" fill="rgba(235,235,245,0.58)" fontSize="10">
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
    price: "$49/mo",
    description: "For a single storefront that wants clean quoting without the ops overhead.",
    features: ["AI image analysis", "Saved quote history", "PDF export"]
  },
  {
    name: "Professional",
    price: "$149/mo",
    description: "For teams who need more quotes, live pricing, and a polished customer flow.",
    features: ["Higher monthly limits", "Live metal pricing", "Brand-ready previews"]
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For multi-location operators that need controls, share links, and scale.",
    features: ["Public quote surface", "Admin controls", "Support for multiple companies"]
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

  const basePricingProfile = context.company.pricingProfile
    ? normalizePricingProfile({
        goldSpotPerOz: Number(context.company.pricingProfile.goldSpotPerOz),
        platinumSpotPerOz: Number(context.company.pricingProfile.platinumSpotPerOz),
        silverSpotPerOz: Number(context.company.pricingProfile.silverSpotPerOz),
        cadCharge: Number(context.company.pricingProfile.cadCharge),
        centerSettingPerCarat: Number(context.company.pricingProfile.centerSettingPerCarat),
        sideSettingPerStone: Number(context.company.pricingProfile.sideSettingPerStone),
        sellingMarginDivisor: Number(context.company.pricingProfile.sellingMarginDivisor),
        finalMultiplier: Number(context.company.pricingProfile.finalMultiplier)
      })
    : undefined;

  const [dashboard, livePricing] = await Promise.all([
    getDashboardData(context.company.id),
    resolveMetalPricing(basePricingProfile)
  ]);

  const subscription = context.company.subscription;
  const trialDaysRemaining = getTrialDaysRemaining(subscription);
  const trialQuotesRemaining = getTrialQuotesRemaining(subscription);
  const pricing = livePricing.pricingProfile;
  const currentPlanCode = subscription?.plan.code ?? "starter";

  return (
    <WorkspaceShell
      title="Workspace overview"
      description="Track quotes, see live pricing, and jump into the next action without leaving the dashboard."
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
      <section className="statGrid" aria-label="Business snapshot">
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
            {currentPlanCode === "enterprise" ? "No orders in production yet" : "Upgrade for orders"}
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
              <strong>Welcome to AutoQuote. Upload your first jewelry photo to generate a quote in seconds.</strong>
              <p className="muted">Create your first quote and this chart will begin to fill in.</p>
              <Link className="button primary" href="/quotes/new">
                New Quote
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
              <span>New Quote</span>
              <strong>Upload a photo to start</strong>
              <p className="muted small">Open the quote builder and start a new estimate.</p>
            </Link>
            {currentPlanCode === "starter" ? (
              <div className="detailCard isDisabled" title="Upgrade to share quotes">
                <span>Share a Quote</span>
                <strong>Send a quote to your customer</strong>
                <p className="muted small">Upgrade to unlock shareable quote links.</p>
              </div>
            ) : (
              <Link className="detailCard" href="/quotes?status=sent">
                <span>Share a Quote</span>
                <strong>Send a quote to your customer</strong>
                <p className="muted small">Open your sent quotes and copy the public link.</p>
              </Link>
            )}
            {currentPlanCode !== "enterprise" ? (
              <div className="detailCard isDisabled" title="Enterprise only">
                <span>Place an Order</span>
                <strong>Submit for manufacturing</strong>
                <p className="muted small">Manufacturing orders are reserved for Enterprise accounts.</p>
              </div>
            ) : (
              <Link className="detailCard" href="/orders">
                <span>Place an Order</span>
                <strong>Submit for manufacturing</strong>
                <p className="muted small">Open the manufacturing workspace.</p>
              </Link>
            )}
          </div>
        </article>
      </section>

      <section className="card">
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
            <strong>Welcome to AutoQuote. Upload your first jewelry photo to generate a quote in seconds.</strong>
            <p className="muted">Your latest five quotes will appear here once you save your first estimate.</p>
            <Link className="button primary" href="/quotes/new">
              New Quote
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
                  <th scope="col">Value</th>
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
                          <img className="quoteThumbnail" src={quote.thumbnailUrl} alt="" />
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
                    <td className="quoteValue">{formatCurrency(quote.estimatedPrice)}</td>
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
                        <Link className="textLink" href={getQuotePublicUrl(quote.id)} target="_blank">
                          Public
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

      <section className="grid twoUp">
        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Recent orders</h2>
              <p className="muted">Enterprise-only manufacturing orders will show up here once enabled.</p>
            </div>
          </div>
          {currentPlanCode === "enterprise" ? (
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

        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Live metal pricing</h2>
              <p className="muted">These rates flow into the quote calculator and public previews.</p>
            </div>
          </div>
          <div className="pricingGrid">
            <div className="detailCard">
              <span>Gold spot / oz</span>
              <strong>{formatCurrency(Number(pricing.goldSpotPerOz))}</strong>
            </div>
            <div className="detailCard">
              <span>Platinum spot / oz</span>
              <strong>{formatCurrency(Number(pricing.platinumSpotPerOz))}</strong>
            </div>
            <div className="detailCard">
              <span>Silver spot / oz</span>
              <strong>{formatCurrency(Number(pricing.silverSpotPerOz))}</strong>
            </div>
            <div className="detailCard">
              <span>Source</span>
              <strong>{livePricing.source === "metals.dev" ? "Live feed" : "Fallback"}</strong>
              <p className="muted small">{livePricing.message}</p>
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
      <section className="marketingHero">
        <div className="marketingHeroInner">
          <div>
            <p className="eyebrow">Azzure AutoQuote</p>
            <h1 className="marketingHeadline">Luxury quote workflows for modern jewelers.</h1>
            <p className="marketingSubheadline">
              Turn a jewelry photo into a polished estimate with AI-assisted analysis, live pricing,
              and a customer-ready quote surface that feels premium from first upload to final approval.
            </p>
          </div>
          <div className="marketingActions">
            <Link className="button primary button--lg" href="/pricing">
              Start free trial
            </Link>
            <Link className="button secondary button--lg" href="/signin">
              Sign in
            </Link>
            <Link className="marketingLink" href="#pricing">
              View pricing
            </Link>
          </div>

          <section className="statGrid">
            {MARKETING_STATS.map((item) => (
              <article key={item.label} className="statCard">
                <span className="eyebrow">{item.label}</span>
                <strong>{item.value}</strong>
                <p className="muted small">{item.detail}</p>
              </article>
            ))}
          </section>
        </div>
      </section>

      <section className="marketingSection">
        <div className="sectionHeader">
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

      <section className="marketingSection" id="pricing">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Plans</p>
            <h2 className="heading">Choose the level of control your shop needs.</h2>
          </div>
        </div>
        <div className="planGrid">
          {PLAN_CARDS.map((plan, index) => (
            <article key={plan.name} className={`planCard${index === 2 ? " enterprise" : ""}`}>
              {index === 0 ? <span className="trialBanner">Popular starter option</span> : null}
              <div className="planName">{plan.name}</div>
              <div className="planPrice">{plan.price}</div>
              <p className="muted">{plan.description}</p>
              <ul className="featureList">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

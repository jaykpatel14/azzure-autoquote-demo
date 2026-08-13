import Link from "next/link";
import { redirect } from "next/navigation";
import TrialBanner from "@/components/trial-banner";
import TrialSidebarStatus from "@/components/trial-sidebar-status";
import WorkspaceShell from "@/components/workspace-shell";
import { getTrialDaysRemaining, getTrialQuotesRemaining } from "@/lib/billing";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { prisma } from "@/lib/prisma";
import { getCurrentUsagePeriod, getUsageRemaining, getUsageWarningMessage } from "@/lib/billing";
import { getWorkspaceNav } from "@/lib/workspace-nav";
import { normalizePricingProfile, resolveMetalPricing } from "@/lib/metal-pricing";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

const FEATURE_STEPS = [
  {
    step: "01",
    title: "Drop in the image",
    description: "Customers upload a jewelry photo and the system queues a moderated image analysis."
  },
  {
    step: "02",
    title: "Review the draft",
    description: "Metal weight, stone assumptions, and pricing overlays stay editable before approval."
  },
  {
    step: "03",
    title: "Send the quote",
    description: "Save the approved price, export the PDF, and share a public quote preview."
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
    description: "For teams who need more quotes, live pricing, and a more polished customer flow.",
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

  const [usagePeriod, recentQuotes, quoteCount, livePricing] = await Promise.all([
    getCurrentUsagePeriod(context.company.id),
    prisma.quote.findMany({
      where: { companyId: context.company.id },
      orderBy: { createdAt: "desc" },
      take: 3
    }),
    prisma.quote.count({ where: { companyId: context.company.id } }),
    resolveMetalPricing(basePricingProfile)
  ]);

  const remaining = usagePeriod ? getUsageRemaining(usagePeriod) : null;
  const warning = usagePeriod ? getUsageWarningMessage(usagePeriod) : null;
  const subscription = context.company.subscription;
  const pricing = livePricing.pricingProfile;
  const trialDaysRemaining = getTrialDaysRemaining(subscription);
  const trialQuotesRemaining = getTrialQuotesRemaining(subscription);

  return (
    <WorkspaceShell
      title="Workspace overview"
      description="Use this space to start quotes, review billing, and check the live pricing that drives every estimate."
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
          <Link className="button secondary" href="/settings">
            Subscription billing
          </Link>
        </>
      }
    >
      <section className="statGrid" aria-label="Workspace overview">
        <article className="statCard">
          <span className="eyebrow">Subscription</span>
          <strong>{subscription?.plan.name ?? "No plan"}</strong>
          <p className="muted small">
            {subscription ? subscription.status.toLowerCase() : "Connect billing to unlock quoting"}
          </p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Quotes saved</span>
          <strong>{quoteCount}</strong>
          <p className="muted small">Saved quotes you can reopen, print, or share.</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Usage remaining</span>
          <strong>{remaining ?? "No usage period"}</strong>
          <p className="muted small">
            {usagePeriod ? `${usagePeriod.used} used, ${usagePeriod.reserved} reserved` : "No active usage period"}
          </p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Live pricing</span>
          <strong>{livePricing.source === "metals.dev" ? "Live feed" : "Stored pricing"}</strong>
          <p className="muted small">{livePricing.message}</p>
        </article>
      </section>

      <section className="grid twoUp">
        <article className="card accentCard">
          <div className="sectionHeader">
            <div>
              <h2>Quick actions</h2>
              <p className="muted">
                Customers only need the quote, history, and billing routes, so the dashboard stays focused.
              </p>
            </div>
          </div>
          <div className="stack">
            <Link className="detailCard" href="/quotes/new">
              <span>New estimate</span>
              <strong>Open the quote builder</strong>
              <p className="muted small">Upload a piece, review the draft, and save the approved price.</p>
            </Link>
            <Link className="detailCard" href="/quotes">
              <span>Quote history</span>
              <strong>Review recent quotes</strong>
              <p className="muted small">Reopen older quotes, check prices, and download PDFs.</p>
            </Link>
            <Link className="detailCard" href="/settings">
              <span>Subscription billing</span>
              <strong>View billing and pricing</strong>
              <p className="muted small">Check billing status and review live metal pricing.</p>
            </Link>
          </div>
        </article>

        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Recent quotes</h2>
              <p className="muted">A quick list of your latest quotes, without the clutter.</p>
            </div>
            <Link href="/quotes" className="textLink">
              Open quote history
            </Link>
          </div>
          {recentQuotes.length === 0 ? (
            <div className="emptyState">
              <strong>No quotes yet</strong>
              <p className="muted">Create a new estimate to populate this list.</p>
            </div>
          ) : (
            <div className="compactList">
              {recentQuotes.map((quote) => (
                <div key={quote.id} className="compactRow">
                  <div>
                    <strong>{quote.quoteNumber}</strong>
                    <p className="muted small">
                      {quote.customerName || "No customer"} - {quote.metalType}
                    </p>
                  </div>
                  <strong>{formatCurrency(Number(quote.estimatedPrice))}</strong>
                </div>
              ))}
            </div>
          )}
          {warning ? <p className="warningBanner">{warning}</p> : null}
        </article>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Live metal pricing</h2>
            <p className="muted">
              These prices come from the live feed when available and are shown in the customer workspace.
            </p>
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
      </section>
    </WorkspaceShell>
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
            <article
              key={plan.name}
              className={`planCard${index === 2 ? " enterprise" : ""}`}
            >
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

      <section className="marketingSection">
        <div className="card">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Why Azzure</p>
              <h2 className="heading">Built to feel premium, without making the operator do more work.</h2>
            </div>
          </div>
          <div className="twoUp">
            <div className="detailCard">
              <span>Quote preview</span>
              <strong>Customer-safe by design</strong>
              <p className="muted small">
                Public quotes can show only the approved final price, so clients get clarity without
                seeing your internal cost structure.
              </p>
            </div>
            <div className="detailCard">
              <span>Workspace</span>
              <strong>Operational and focused</strong>
              <p className="muted small">
                The dashboard keeps analysis, billing, and quote history in one place so your team can
                move quickly without losing the thread.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

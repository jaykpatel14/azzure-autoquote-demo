import Link from "next/link";
import { redirect } from "next/navigation";
import WorkspaceShell from "@/components/workspace-shell";
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

export default async function HomePage() {
  const adminContext = await getInternalAdminContext();
  if (adminContext) {
    redirect("/admin");
  }

  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
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

  return (
    <WorkspaceShell
      title="Workspace overview"
      description="Use this space to start quotes, review billing, and check the live pricing that drives every estimate."
      navItems={getWorkspaceNav("/")}
      actions={
        <div className="heroActions">
          <Link className="button primary" href="/quotes/new">
            New estimate
          </Link>
          <Link className="button secondary" href="/quotes">
            Quote history
          </Link>
          <Link className="button secondary" href="/settings">
            Subscription billing
          </Link>
        </div>
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

import Link from "next/link";
import { redirect } from "next/navigation";
import WorkspaceShell from "@/components/workspace-shell";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { prisma } from "@/lib/prisma";
import { normalizePricingProfile, resolveMetalPricing } from "@/lib/metal-pricing";
import { getCurrentUsagePeriod, getUsageRemaining, getUsageWarningMessage } from "@/lib/billing";
import { hasMinimumRole } from "@/lib/tenant";
import { getWorkspaceNav } from "@/lib/workspace-nav";

export default async function HomePage() {
  const adminContext = await getInternalAdminContext();
  if (adminContext) {
    redirect("/admin");
  }

  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  const canEdit = hasMinimumRole(context.membership.role, "ESTIMATOR");
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

  return (
    <WorkspaceShell
      title="Dashboard"
      description="Track workspace health at a glance and jump into the area you need."
      navItems={getWorkspaceNav("/")}
      actions={
        <div className="heroActions">
          <Link className="button secondary" href="/quotes">
            View history
          </Link>
          <Link className="button primary" href="/quotes/new">
            New estimate
          </Link>
        </div>
      }
    >
      <section className="statGrid" aria-label="Workspace overview">
        <article className="statCard">
          <span className="eyebrow">Current plan</span>
          <strong>{subscription?.plan.name ?? "No plan"}</strong>
          <p className="muted small">
            {subscription
              ? `${subscription.status.toLowerCase()} billing cycle`
              : "Connect billing to unlock analysis and quoting"}
          </p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Quotes saved</span>
          <strong>{quoteCount}</strong>
          <p className="muted small">Tenant-scoped quote history for this company only.</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Usage remaining</span>
          <strong>{remaining ?? "No usage period"}</strong>
          <p className="muted small">
            {usagePeriod ? `${usagePeriod.used} used, ${usagePeriod.reserved} reserved` : "No active usage period"}
          </p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Team access</span>
          <strong>{context.memberships.length}</strong>
          <p className="muted small">Members can belong to multiple companies and switch safely.</p>
        </article>
      </section>

      <section className="grid twoUp">
        <article className="card accentCard">
          <div className="sectionHeader">
            <div>
              <h2>Workspace shortcuts</h2>
              <p className="muted">
                Jump straight to the main routes instead of keeping every workflow on the home page.
              </p>
            </div>
          </div>
          <div className="stack">
            <Link className="detailCard" href="/quotes/new">
              <span>New estimate</span>
              <strong>Open the quote builder</strong>
              <p className="muted small">Upload an image, review the AI draft, and save a quote.</p>
            </Link>
            <Link className="detailCard" href="/quotes">
              <span>Quote history</span>
              <strong>Review saved quotes</strong>
              <p className="muted small">See the full company history and approved prices.</p>
            </Link>
            <Link className="detailCard" href="/settings">
              <span>Pricing and billing</span>
              <strong>Manage live pricing and plans</strong>
              <p className="muted small">Inspect live metals data, pricing inputs, and Stripe billing.</p>
            </Link>
          </div>
        </article>

        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Recent quotes</h2>
              <p className="muted">
                The three most recent quotes are still shown here as a quick snapshot.
              </p>
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
                      {quote.customerName || "No customer"} | {quote.metalType}
                    </p>
                  </div>
                  <strong>
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                      Number(quote.estimatedPrice)
                    )}
                  </strong>
                </div>
              ))}
            </div>
          )}
          {warning ? <p className="warningBanner">{warning}</p> : null}
        </article>
      </section>
    </WorkspaceShell>
  );
}

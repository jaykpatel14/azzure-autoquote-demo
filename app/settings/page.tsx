import Link from "next/link";
import { redirect } from "next/navigation";
import type { MembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/components/workspace-shell";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { normalizePricingProfile, resolveMetalPricing } from "@/lib/metal-pricing";
import { getCurrentUsagePeriod, getUsageRemaining, getUsageWarningMessage } from "@/lib/billing";
import { syncStripeCheckoutSession } from "@/lib/billing-webhooks";
import { hasMinimumRole } from "@/lib/tenant";
import { getWorkspaceNav } from "@/lib/workspace-nav";

type SettingsPageProps = {
  searchParams?: Promise<{
    billing?: string;
    session_id?: string;
  }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  if (!hasMinimumRole(context.membership.role, "ADMIN")) {
    redirect("/");
  }

  if (params?.billing === "success" && params.session_id) {
    await syncStripeCheckoutSession(params.session_id, {
      expectedCompanyId: context.company.id
    });
    redirect("/settings");
  }

  const [usagePeriod, billingPlans] = await Promise.all([
    getCurrentUsagePeriod(context.company.id),
    prisma.plan.findMany({
      where: { code: { in: ["professional", "enterprise"] } },
      orderBy: { monthlyPriceCents: "asc" }
    })
  ]);

  const subscription = context.company.subscription;
  const warning = usagePeriod ? getUsageWarningMessage(usagePeriod) : null;
  const remaining = usagePeriod ? getUsageRemaining(usagePeriod) : null;
  const pricingProfile = context.company.pricingProfile
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
  const livePricing = await resolveMetalPricing(pricingProfile);
  const memberCounts: Record<MembershipRole, number> = context.memberships.reduce(
    (acc, membership) => {
      acc[membership.role] += 1;
      return acc;
    },
    { OWNER: 0, ADMIN: 0, ESTIMATOR: 0, VIEWER: 0 }
  );

  return (
    <WorkspaceShell
      title="Billing and settings"
      description="Manage plans, inspect pricing inputs, and keep workspace controls in one place."
      navItems={getWorkspaceNav("/settings")}
      actions={
        <Link className="button secondary" href="/quotes/new">
          New estimate
        </Link>
      }
    >
      <section className="statGrid">
        <article className="statCard">
          <span className="eyebrow">Usage window</span>
          <strong>{remaining ?? "No usage period"}</strong>
          <p className="muted small">
            {usagePeriod ? `${usagePeriod.used} used, ${usagePeriod.reserved} reserved` : "No active usage period"}
          </p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Subscription</span>
          <strong>{subscription?.status.toLowerCase() ?? "inactive"}</strong>
          <p className="muted small">{subscription?.plan.name ?? "No active plan"}</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Team size</span>
          <strong>{context.memberships.length}</strong>
          <p className="muted small">
            {memberCounts.OWNER} owner, {memberCounts.ADMIN} admin, {memberCounts.ESTIMATOR} estimator
          </p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Pricing profile</span>
          <strong>{livePricing.source === "metals.dev" ? "Live metals feed" : "Configured defaults"}</strong>
          <p className="muted small">Server-side pricing protects the final quote calculation.</p>
        </article>
      </section>

      <section className="grid twoUp">
        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Usage and billing</h2>
              <p className="muted">
                Stripe controls the subscription, while the app enforces access from the database.
              </p>
            </div>
          </div>
          {subscription ? (
            <div className="stack">
              <div className="detailRow">
                <span>Current plan</span>
                <strong>{subscription.plan.name}</strong>
              </div>
              <div className="detailRow">
                <span>Status</span>
                <strong>{subscription.status.toLowerCase()}</strong>
              </div>
              <div className="detailRow">
                <span>Billing period</span>
                <strong>
                  {subscription.currentPeriodStart.toLocaleDateString()} to{" "}
                  {subscription.currentPeriodEnd.toLocaleDateString()}
                </strong>
              </div>
              <div className="detailRow">
                <span>Monthly limit</span>
                <strong>{subscription.plan.monthlyLimit}</strong>
              </div>
              {usagePeriod ? (
                <div className="usageMeter" aria-label="Usage meter">
                  <div className="usageMeterTrack">
                    <div
                      className="usageMeterFill"
                      style={{
                        width: `${Math.min(100, ((usagePeriod.used + usagePeriod.reserved) / usagePeriod.limit) * 100)}%`
                      }}
                    />
                  </div>
                  <p className="muted small">
                    {usagePeriod.used} used, {usagePeriod.reserved} reserved, {remaining} remaining
                  </p>
                  {warning ? <p className="warningBanner">{warning}</p> : null}
                </div>
              ) : (
                <div className="emptyState">
                  <strong>No active usage period</strong>
                  <p className="muted">
                    Billing sync should create one at the start of the current subscription cycle.
                  </p>
                </div>
              )}
              <form action="/api/billing/portal" method="post">
                <button className="button primary" type="submit" disabled={!subscription.stripeCustomerId}>
                  Manage billing in Stripe
                </button>
              </form>
              {!subscription.stripeCustomerId ? (
                <p className="muted small">
                  The billing portal becomes available after the first Stripe checkout session.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="emptyState">
              <strong>No subscription record yet</strong>
              <p className="muted">Choose a plan to activate billing and usage enforcement.</p>
            </div>
          )}
        </article>

        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Pricing settings</h2>
              <p className="muted">
                These are the server-side pricing inputs used when quotes are calculated.
              </p>
            </div>
          </div>
          <div className="pricingGrid">
            <div className="detailCard">
              <span>Gold spot / oz</span>
              <strong>{pricingProfile ? Number(pricingProfile.goldSpotPerOz).toFixed(2) : "$4,500.00"}</strong>
            </div>
            <div className="detailCard">
              <span>Platinum spot / oz</span>
              <strong>{pricingProfile ? Number(pricingProfile.platinumSpotPerOz).toFixed(2) : "$2,000.00"}</strong>
            </div>
            <div className="detailCard">
              <span>Silver spot / oz</span>
              <strong>{pricingProfile ? Number(pricingProfile.silverSpotPerOz).toFixed(2) : "$100.00"}</strong>
            </div>
            <div className="detailCard">
              <span>CAD charge</span>
              <strong>{pricingProfile ? Number(pricingProfile.cadCharge).toFixed(2) : "$25.00"}</strong>
            </div>
            <div className="detailCard">
              <span>Center setting / ct</span>
              <strong>{pricingProfile ? Number(pricingProfile.centerSettingPerCarat).toFixed(2) : "$15.00"}</strong>
            </div>
            <div className="detailCard">
              <span>Side stone / piece</span>
              <strong>{pricingProfile ? Number(pricingProfile.sideSettingPerStone).toFixed(2) : "$3.00"}</strong>
            </div>
            <div className="detailCard">
              <span>Selling margin divisor</span>
              <strong>{pricingProfile ? Number(pricingProfile.sellingMarginDivisor).toFixed(2) : "0.70"}</strong>
            </div>
            <div className="detailCard">
              <span>Final multiplier</span>
              <strong>{pricingProfile ? Number(pricingProfile.finalMultiplier).toFixed(2) : "2.00"}</strong>
            </div>
            <div className="detailCard">
              <span>Live price source</span>
              <strong>{livePricing.source === "metals.dev" ? "Metals.dev" : "Fallback"}</strong>
              <p className="muted small">{livePricing.message}</p>
            </div>
          </div>
          <p className="disclaimer">
            Pricing is calculated on the server before persistence. Customer-facing quotes only
            show the approved final price.
          </p>
        </article>
      </section>

      <section className="grid twoUp">
        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Plan switching</h2>
              <p className="muted">
                Active plan changes are confirmed through Stripe checkout and synced back into the database.
              </p>
            </div>
          </div>
          <div className="stack">
            {billingPlans.map((plan) => (
              <form key={plan.id} action="/api/billing/checkout" method="post" className="planCard">
                <div>
                  <p className="planName">{plan.name}</p>
                  <p className="muted small">
                    ${(plan.monthlyPriceCents / 100).toFixed(2)}/month for {plan.monthlyLimit} estimates
                    {plan.isConfigurable ? " - configurable" : ""}
                  </p>
                </div>
                <input type="hidden" name="planCode" value={plan.code} />
                <button className="button primary" type="submit" disabled={!plan.stripePriceId}>
                  {subscription?.plan.code === plan.code ? "Manage / switch" : `Choose ${plan.name}`}
                </button>
                {!plan.stripePriceId ? (
                  <p className="muted small">Stripe price id not configured for this plan yet.</p>
                ) : null}
              </form>
            ))}
          </div>
        </article>

        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Team management</h2>
              <p className="muted">Memberships are company-scoped and every record stays tenant-isolated.</p>
            </div>
            <Link className="textLink" href="/team">
              Open team page
            </Link>
          </div>
          <div className="compactList">
            {context.memberships.map((membership) => (
              <div className="compactRow" key={membership.id}>
                <div>
                  <strong>{membership.company.name}</strong>
                  <p className="muted small">{membership.role}</p>
                </div>
                <span className="badge">{membership.company.slug}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Admin support</h2>
            <p className="muted">
              Keep this area for billing support, webhook health, and operational notes.
            </p>
          </div>
        </div>
        <div className="supportGrid">
          <div className="detailCard">
            <span>Billing portal</span>
            <strong>Managed by Stripe</strong>
            <p className="muted small">Use the portal for card updates, invoices, and subscription changes.</p>
          </div>
          <div className="detailCard">
            <span>Webhook health</span>
            <strong>Server-verified</strong>
            <p className="muted small">Duplicate events are idempotent and processed inside the database.</p>
          </div>
          <div className="detailCard">
            <span>Data retention</span>
            <strong>Tenant-isolated</strong>
            <p className="muted small">Delete or archive company records from the database when required.</p>
          </div>
        </div>
      </section>
    </WorkspaceShell>
  );
}

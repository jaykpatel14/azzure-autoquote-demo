import Link from "next/link";
import { redirect } from "next/navigation";
import type { MembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/components/workspace-shell";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { resolveMetalPricing, toPricingProfileInput } from "@/lib/metal-pricing";
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
  const pricingProfile = toPricingProfileInput(context.company.pricingProfile);
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
      navItems={getWorkspaceNav("/settings", context.membership.role)}
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
                Live metal spot prices are read-only. Customer admins can update the backend pricing
                inputs below.
              </p>
            </div>
          </div>
          <div className="pricingGrid">
            <div className="detailCard">
              <span>Gold spot / oz</span>
              <strong>{Number(livePricing.pricingProfile.goldSpotPerOz ?? pricingProfile.goldSpotPerOz).toFixed(2)}</strong>
            </div>
            <div className="detailCard">
              <span>Platinum spot / oz</span>
              <strong>{Number(livePricing.pricingProfile.platinumSpotPerOz ?? pricingProfile.platinumSpotPerOz).toFixed(2)}</strong>
            </div>
            <div className="detailCard">
              <span>Silver spot / oz</span>
              <strong>{Number(livePricing.pricingProfile.silverSpotPerOz ?? pricingProfile.silverSpotPerOz).toFixed(2)}</strong>
            </div>
            <div className="detailCard">
              <span>Live price source</span>
              <strong>{livePricing.source === "metals.dev" ? "Morning live feed" : "Fallback"}</strong>
              <p className="muted small">{livePricing.message}</p>
            </div>
          </div>

          <form className="stack" action="/api/company/pricing" method="post">
            <input type="hidden" name="redirectTo" value="/settings" />
            <div className="sectionHeader" style={{ marginTop: 8 }}>
              <div>
                <h3>Editable backend pricing</h3>
                <p className="muted">
                  These values affect quote math, but they do not replace the live spot metal feed.
                </p>
              </div>
            </div>
            <div className="fields">
              <div className="field">
                <label htmlFor="cadCharge">CAD charge</label>
                <input
                  id="cadCharge"
                  name="cadCharge"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={pricingProfile.cadCharge}
                />
              </div>
              <div className="field">
                <label htmlFor="centerSettingPerCarat">Center setting / ct</label>
                <input
                  id="centerSettingPerCarat"
                  name="centerSettingPerCarat"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={pricingProfile.centerSettingPerCarat}
                />
              </div>
              <div className="field">
                <label htmlFor="sideSettingPerStone">Side stone / piece</label>
                <input
                  id="sideSettingPerStone"
                  name="sideSettingPerStone"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={pricingProfile.sideSettingPerStone}
                />
              </div>
              <div className="field">
                <label htmlFor="sellingMarginDivisor">Selling margin divisor</label>
                <input
                  id="sellingMarginDivisor"
                  name="sellingMarginDivisor"
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={pricingProfile.sellingMarginDivisor}
                />
              </div>
              <div className="field">
                <label htmlFor="finalMultiplier">Final multiplier</label>
                <input
                  id="finalMultiplier"
                  name="finalMultiplier"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={pricingProfile.finalMultiplier}
                />
              </div>
            </div>
            <div className="buttonRow">
              <button className="button primary" type="submit">
                Save backend pricing
              </button>
            </div>
          </form>
          <p className="disclaimer">
            Gold, platinum, and silver are fetched from the live feed each Toronto morning and remain
            read-only in this console.
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

    </WorkspaceShell>
  );
}

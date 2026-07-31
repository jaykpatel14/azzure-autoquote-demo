import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/components/workspace-shell";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import {
  getCurrentUsagePeriod,
  getEffectiveMonthlyLimit,
  getUsageRemaining,
  getUsageWarningMessage
} from "@/lib/billing";
import { resolveMetalPricing, toPricingProfileInput } from "@/lib/metal-pricing";
import { syncStripeCheckoutSession } from "@/lib/billing-webhooks";
import { getWorkspaceNav } from "@/lib/workspace-nav";

type SettingsPageProps = {
  searchParams?: Promise<{
    billing?: string;
    session_id?: string;
  }>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function formatPlanPrice(monthlyPriceCents: number) {
  return formatCurrency(monthlyPriceCents / 100);
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  if (params?.billing === "success" && params.session_id) {
    await syncStripeCheckoutSession(params.session_id, {
      expectedCompanyId: context.company.id
    });
    redirect("/settings");
  }

  const usagePeriod = await getCurrentUsagePeriod(context.company.id);
  const subscription = context.company.subscription;
  const warning = usagePeriod ? getUsageWarningMessage(usagePeriod) : null;
  const remaining = usagePeriod ? getUsageRemaining(usagePeriod) : null;
  const effectiveMonthlyLimit = subscription
    ? getEffectiveMonthlyLimit({
        status: subscription.status,
        plan: subscription.plan
      })
    : null;
  const availablePlans = await prisma.plan.findMany({
    where: {
      OR: [{ stripePriceId: { not: null } }, { stripeProductId: { not: null } }]
    },
    orderBy: { monthlyPriceCents: "asc" }
  });
  const pricingProfile = toPricingProfileInput(context.company.pricingProfile);
  const livePricing = await resolveMetalPricing(pricingProfile);

  return (
    <WorkspaceShell
      title="Subscription billing"
      description="Review billing, usage, and live metal pricing from the customer workspace."
      navItems={getWorkspaceNav("/settings")}
      actions={
        <div className="heroActions">
          <Link className="button secondary" href="/quotes/new">
            New estimate
          </Link>
          <Link className="button secondary" href="/quotes">
            Quote history
          </Link>
        </div>
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
          <span className="eyebrow">Company access</span>
          <strong>{context.memberships.length} customer account{context.memberships.length === 1 ? "" : "s"}</strong>
          <p className="muted small">All company users have the same customer permissions.</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Live pricing</span>
          <strong>{livePricing.source === "metals.dev" ? "Live feed" : "Stored pricing"}</strong>
          <p className="muted small">{livePricing.message}</p>
        </article>
      </section>

      <section className="grid twoUp">
        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Subscription billing</h2>
              <p className="muted">Customers can review their plan, billing status, and usage here.</p>
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
                <strong>{effectiveMonthlyLimit}</strong>
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
              {subscription.status === "TRIALING" ? (
                <div className="stack">
                  <div className="sectionHeader" style={{ marginTop: "1rem" }}>
                    <div>
                      <h3>Choose a subscription</h3>
                      <p className="muted">
                        Trial accounts are capped at {effectiveMonthlyLimit} requests. Pick a paid plan to upgrade.
                      </p>
                    </div>
                  </div>
                  {availablePlans.length > 0 ? (
                    <div className="pricingGrid">
                      {availablePlans.map((plan) => (
                        <form key={plan.id} action="/api/billing/checkout" method="post" className="detailCard">
                          <input type="hidden" name="planCode" value={plan.code} />
                          <span>{plan.name}</span>
                          <strong>{formatPlanPrice(plan.monthlyPriceCents)} / month</strong>
                          <p className="muted small">{plan.monthlyLimit} requests per billing period.</p>
                          <button className="button primary" type="submit">
                            Choose {plan.name}
                          </button>
                        </form>
                      ))}
                    </div>
                  ) : (
                    <div className="emptyState">
                      <strong>No subscription plans available</strong>
                      <p className="muted">
                        No Stripe-enabled plans are configured yet. Please contact support.
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
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
              <h2>Live metal pricing</h2>
              <p className="muted">
                Live spot pricing is visible to customers so quote calculations stay transparent.
              </p>
            </div>
          </div>
          <div className="pricingGrid">
            <div className="detailCard">
              <span>Gold spot / oz</span>
              <strong>{formatCurrency(Number(livePricing.pricingProfile.goldSpotPerOz))}</strong>
            </div>
            <div className="detailCard">
              <span>Platinum spot / oz</span>
              <strong>{formatCurrency(Number(livePricing.pricingProfile.platinumSpotPerOz))}</strong>
            </div>
            <div className="detailCard">
              <span>Silver spot / oz</span>
              <strong>{formatCurrency(Number(livePricing.pricingProfile.silverSpotPerOz))}</strong>
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

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SubscriptionStatus } from "@prisma/client";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav, requireAdminRouteAccess } from "@/lib/internal-admin-nav";
import { prisma } from "@/lib/prisma";
import { resolveMetalPricing, toPricingProfileInput } from "@/lib/metal-pricing";
import { ensureBasePlans } from "@/lib/plan-bootstrap";

type CompanyBillingPageProps = {
  params: Promise<{
    companyId: string;
  }>;
};

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfCurrentMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfNextMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

export const dynamic = "force-dynamic";

export default async function AdminCompanyBillingPage({ params }: CompanyBillingPageProps) {
  const context = await getInternalAdminContext();
  if (!context) {
    redirect("/signin");
  }

  requireAdminRouteAccess("/admin/billing", context.user.adminRole );

  const { companyId } = await params;
  await ensureBasePlans(prisma);
  const [company, plans] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      include: {
        subscription: {
          include: { plan: true }
        },
        pricingProfile: true,
        memberships: {
          include: { user: { select: { name: true, email: true } } },
          orderBy: { id: "desc" }
        },
        quotes: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { quoteNumber: true, estimatedPrice: true, createdAt: true }
        },
        auditLogs: {
          orderBy: { createdAt: "desc" },
          take: 5
        },
        usagePeriods: {
          orderBy: { periodStart: "desc" },
          take: 3
        }
      }
    }),
    prisma.plan.findMany({
      where: { code: { in: ["starter", "professional", "enterprise"] } },
      orderBy: { monthlyPriceCents: "asc" }
    })
  ]);

  if (!company) {
    notFound();
  }

  const pricingProfile = toPricingProfileInput(company.pricingProfile);
  const subscription = company.subscription;
  const defaultPeriodStart = subscription?.currentPeriodStart ?? startOfCurrentMonth();
  const defaultPeriodEnd = subscription?.currentPeriodEnd ?? startOfNextMonth();
  const livePricing = await resolveMetalPricing(pricingProfile);
  const editablePricingProfile = livePricing.pricingProfile;

  return (
    <InternalAdminShell
      title={`${company.name} billing`}
      description="Edit the company billing record, pricing profile, and subscription details from one screen."
      navItems={getInternalAdminNav("/admin/billing", context.user.adminRole )}
      adminName={context.user.name || context.user.email}
      actions={
        <Link className="button secondary" href="/admin/billing">
          Back to billing
        </Link>
      }
    >
      <section className="statGrid">
        <article className="statCard">
          <span className="eyebrow">Subscription</span>
          <strong>{subscription?.status.toLowerCase() ?? "inactive"}</strong>
          <p className="muted small">{subscription?.plan.name ?? "No subscription record"}</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Current plan</span>
          <strong>{subscription?.plan.code ?? "None"}</strong>
          <p className="muted small">Editable billing plan for this tenant.</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Quotes</span>
          <strong>{company.quotes.length}</strong>
          <p className="muted small">Recent quote history for support context.</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Usage periods</span>
          <strong>{company.usagePeriods.length}</strong>
          <p className="muted small">Current and recent billing windows.</p>
        </article>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Billing and settings</h2>
            <p className="muted">
              Update company identity, Stripe identifiers, billing status, and pricing defaults in one place.
            </p>
          </div>
        </div>

        <form className="stack" action={`/api/admin/billing/${company.id}`} method="post">
          <input type="hidden" name="redirectTo" value={`/admin/billing/${company.id}`} />

          <div className="grid twoUp">
            <label className="field">
              <span>Company name</span>
              <input name="companyName" defaultValue={company.name} required />
            </label>
            <label className="field">
              <span>Company slug</span>
              <input
                name="companySlug"
                defaultValue={company.slug}
                placeholder="Leave blank to keep current slug"
              />
            </label>
          </div>

          <div className="grid twoUp">
            <label className="field">
              <span>Logo URL</span>
              <input name="logoUrl" defaultValue={company.logoUrl ?? ""} placeholder="https://..." />
            </label>
            <label className="field">
              <span>Quote sequence</span>
              <input name="quoteSequence" type="number" min={0} defaultValue={company.quoteSequence} />
            </label>
          </div>

          <div className="card" style={{ background: "rgba(255,255,255,0.6)" }}>
            <div className="sectionHeader">
              <div>
                <h3>Subscription</h3>
                <p className="muted">Stripe and plan values that drive billing and usage limits.</p>
              </div>
            </div>
            <div className="grid twoUp">
              <label className="field">
                <span>Plan</span>
                <select name="planId" defaultValue={subscription?.planId ?? plans[0]?.id ?? ""}>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} ({plan.code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Status</span>
                <select name="subscriptionStatus" defaultValue={subscription?.status ?? SubscriptionStatus.TRIALING}>
                  {Object.values(SubscriptionStatus).map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid twoUp">
              <label className="field">
                <span>Stripe customer id</span>
                <input name="stripeCustomerId" defaultValue={subscription?.stripeCustomerId ?? ""} />
              </label>
              <label className="field">
                <span>Stripe subscription id</span>
                <input name="stripeSubscriptionId" defaultValue={subscription?.stripeSubscriptionId ?? ""} />
              </label>
            </div>

            <div className="grid twoUp">
              <label className="field">
                <span>Stripe product id</span>
                <input name="stripeProductId" defaultValue={subscription?.stripeProductId ?? ""} />
              </label>
              <label className="field">
                <span>Stripe price id</span>
                <input name="stripePriceId" defaultValue={subscription?.stripePriceId ?? ""} />
              </label>
            </div>

            <div className="grid twoUp">
              <label className="field">
                <span>Current period start</span>
                <input
                  name="currentPeriodStart"
                  type="date"
                  defaultValue={toDateInputValue(defaultPeriodStart)}
                />
              </label>
              <label className="field">
                <span>Current period end</span>
                <input
                  name="currentPeriodEnd"
                  type="date"
                  defaultValue={toDateInputValue(defaultPeriodEnd)}
                />
              </label>
            </div>

            <div className="grid twoUp">
              <label className="field">
                <span>Overage price cents</span>
                <input
                  name="overagePriceCents"
                  type="number"
                  min={0}
                  defaultValue={subscription?.overagePriceCents ?? ""}
                  placeholder="Optional"
                />
              </label>
              <div className="field">
                <span>Billing toggles</span>
                <label className="checkboxLine">
                  <input
                    type="checkbox"
                    name="cancelAtPeriodEnd"
                    defaultChecked={subscription?.cancelAtPeriodEnd ?? false}
                  />
                  <span>Cancel at period end</span>
                </label>
                <label className="checkboxLine">
                  <input
                    type="checkbox"
                    name="overageEnabled"
                    defaultChecked={subscription?.overageEnabled ?? false}
                  />
                  <span>Enable overage billing</span>
                </label>
              </div>
            </div>
          </div>

          <div className="card" style={{ background: "rgba(255,255,255,0.6)" }}>
            <div className="sectionHeader">
              <div>
                <h3>Pricing profile</h3>
                <p className="muted">Edit the resolved pricing inputs used by the quote calculator.</p>
              </div>
            </div>
            <div className="grid twoUp">
              <label className="field">
                <span>Gold spot / oz</span>
                <input
                  name="goldSpotPerOz"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={editablePricingProfile.goldSpotPerOz}
                />
              </label>
              <label className="field">
                <span>Platinum spot / oz</span>
                <input
                  name="platinumSpotPerOz"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={editablePricingProfile.platinumSpotPerOz}
                />
              </label>
            </div>

            <div className="grid twoUp">
              <label className="field">
                <span>Silver spot / oz</span>
                <input
                  name="silverSpotPerOz"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={editablePricingProfile.silverSpotPerOz}
                />
              </label>
              <label className="field">
                <span>CAD charge</span>
                <input
                  name="cadCharge"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={editablePricingProfile.cadCharge}
                />
              </label>
            </div>

            <div className="grid twoUp">
              <label className="field">
                <span>Center setting / ct</span>
                <input
                  name="centerSettingPerCarat"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={editablePricingProfile.centerSettingPerCarat}
                />
              </label>
              <label className="field">
                <span>Side setting / stone</span>
                <input
                  name="sideSettingPerStone"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={editablePricingProfile.sideSettingPerStone}
                />
              </label>
            </div>

            <div className="grid twoUp">
              <label className="field">
                <span>Selling margin divisor</span>
                <input
                  name="sellingMarginDivisor"
                  type="number"
                  min={0.01}
                  step="0.01"
                  defaultValue={editablePricingProfile.sellingMarginDivisor}
                />
              </label>
              <label className="field">
                <span>Final multiplier</span>
                <input
                  name="finalMultiplier"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={editablePricingProfile.finalMultiplier}
                />
              </label>
            </div>
          </div>

          <div className="heroActions">
            <button className="button primary" type="submit">
              Save billing and settings
            </button>
          </div>
        </form>
      </section>

      <section className="grid twoUp">
        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Recent members</h2>
              <p className="muted">Helpful when support needs to verify who should have access.</p>
            </div>
          </div>
          <div className="stack">
            {company.memberships.map((membership) => (
              <div className="detailCard" key={membership.id}>
                <span>{membership.role}</span>
                <strong>{membership.user.name || membership.user.email}</strong>
                <p className="muted small">{membership.user.email}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Recent quotes</h2>
              <p className="muted">Latest approved values for billing and support review.</p>
            </div>
          </div>
          <div className="stack">
            {company.quotes.length === 0 ? (
              <div className="emptyState">
                <strong>No quotes yet</strong>
              </div>
            ) : (
              company.quotes.map((quote) => (
                <div className="detailCard" key={quote.quoteNumber}>
                  <span>{quote.quoteNumber}</span>
                  <strong>
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD"
                    }).format(Number(quote.estimatedPrice))}
                  </strong>
                  <p className="muted small">{quote.createdAt.toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Live metal pricing</h2>
            <p className="muted">
              Read-only live source data. Support can view it, but nobody can edit it from the admin
              console.
            </p>
          </div>
        </div>
        <div className="pricingGrid">
          <div className="detailCard">
            <span>Gold spot / oz</span>
            <strong>{Number(livePricing.pricingProfile.goldSpotPerOz).toFixed(2)}</strong>
          </div>
          <div className="detailCard">
            <span>Platinum spot / oz</span>
            <strong>{Number(livePricing.pricingProfile.platinumSpotPerOz).toFixed(2)}</strong>
          </div>
          <div className="detailCard">
            <span>Silver spot / oz</span>
            <strong>{Number(livePricing.pricingProfile.silverSpotPerOz).toFixed(2)}</strong>
          </div>
          <div className="detailCard">
            <span>Source</span>
            <strong>{livePricing.source !== "configured-default" ? "Live feed" : "Fallback"}</strong>
            <p className="muted small">{livePricing.message}</p>
          </div>
        </div>
      </section>
    </InternalAdminShell>
  );
}

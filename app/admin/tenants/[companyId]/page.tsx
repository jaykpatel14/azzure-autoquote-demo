import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav } from "@/lib/internal-admin-nav";
import { formatAdminMoney, getAdminTenant } from "@/src/services/admin-tenants";

type TenantPageProps = {
  params: Promise<{
    companyId: string;
  }>;
};

function formatDate(date: Date | null | undefined) {
  return date ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date) : "Never";
}

export const dynamic = "force-dynamic";

export default async function AdminTenantPage({ params }: TenantPageProps) {
  const context = await getInternalAdminContext();
  if (!context) {
    redirect("/signin");
  }

  const { companyId } = await params;
  const data = await getAdminTenant(companyId);
  if (!data) {
    notFound();
  }

  const { company } = data;
  const subscription = data.subscription;

  return (
    <InternalAdminShell
      title={company.name}
      description="Tenant detail with subscription health, pricing profile, activity history, and support actions."
      navItems={getInternalAdminNav("/admin/tenants")}
      adminName={context.user.name || context.user.email}
      actions={
        <>
          <Link className="button secondary" href={`/admin/billing/${company.id}`}>
            Edit billing
          </Link>
          <form action={`/api/admin/tenants/${company.id}/impersonate`} method="post">
            <button className="button secondary" type="submit">
              Open company context
            </button>
          </form>
        </>
      }
    >
      <section className="statGrid">
        <article className="statCard statCard--admin">
          <span className="eyebrow">Subscription</span>
          <strong>{subscription?.status.toLowerCase() ?? "inactive"}</strong>
          <p className="muted small">{subscription?.plan.name ?? "No plan assigned"}</p>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Quotes</span>
          <strong>{data.stats.quotes}</strong>
          <p className="muted small">Quote history available for review.</p>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Orders</span>
          <strong>{data.stats.orders}</strong>
          <p className="muted small">Manufacturing orders linked to this tenant.</p>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Members</span>
          <strong>{data.stats.members}</strong>
          <p className="muted small">Users assigned to the company.</p>
        </article>
      </section>

      <section className="grid twoUp">
        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Company profile</h2>
              <p className="muted">Identity, trial state, and current billing posture.</p>
            </div>
          </div>
          <div className="stack">
            <div className="detailCard">
              <span>Slug</span>
              <strong>{company.slug}</strong>
              <p className="muted small">Created {formatDate(company.createdAt)}</p>
            </div>
            <div className="detailCard">
              <span>Quote sequence</span>
              <strong>{company.quoteSequence}</strong>
            </div>
            <div className="detailCard">
              <span>Website</span>
              <strong>{company.websiteUrl || "Not set"}</strong>
            </div>
            <div className="detailCard">
              <span>About us</span>
              <strong>{company.aboutUs ? "Configured" : "Not set"}</strong>
            </div>
          </div>
        </article>

        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Subscription snapshot</h2>
              <p className="muted">Support-friendly view of plan, current period, and usage guardrails.</p>
            </div>
          </div>
          <div className="stack">
            <div className="detailCard">
              <span>Plan</span>
              <strong>{subscription?.plan.code ?? "No plan"}</strong>
              <p className="muted small">{subscription?.plan.monthlyLimit ?? 0} requests/month</p>
            </div>
            <div className="detailCard">
              <span>Current period</span>
              <strong>{formatDate(subscription?.currentPeriodStart)} - {formatDate(subscription?.currentPeriodEnd)}</strong>
            </div>
            <div className="detailCard">
              <span>Trial usage</span>
              <strong>
                {subscription?.trialQuotesUsed ?? 0} / {subscription?.trialQuoteCap ?? 0}
              </strong>
            </div>
            <div className="detailCard">
              <span>Overage</span>
              <strong>{subscription?.overageEnabled ? "Enabled" : "Disabled"}</strong>
              <p className="muted small">
                {subscription?.overagePriceCents ? formatAdminMoney(subscription.overagePriceCents / 100) : "No overage price"}
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="grid twoUp">
        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Members</h2>
              <p className="muted">Who can sign in and work this tenant.</p>
            </div>
          </div>
          <div className="stack">
            {data.company.memberships.map((membership) => (
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
              <h2>Pricing profile</h2>
              <p className="muted">Current calculator inputs saved for this tenant.</p>
            </div>
          </div>
          <div className="pricingGrid">
            <div className="detailCard">
              <span>Gold / oz</span>
              <strong>{Number(data.pricingProfile.goldSpotPerOz).toFixed(2)}</strong>
            </div>
            <div className="detailCard">
              <span>CAD charge</span>
              <strong>{Number(data.pricingProfile.cadCharge).toFixed(2)}</strong>
            </div>
            <div className="detailCard">
              <span>Center / ct</span>
              <strong>{Number(data.pricingProfile.centerSettingPerCarat).toFixed(2)}</strong>
            </div>
            <div className="detailCard">
              <span>Final multiplier</span>
              <strong>{Number(data.pricingProfile.finalMultiplier).toFixed(2)}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="grid twoUp">
        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Recent quotes</h2>
              <p className="muted">Latest estimates and approved pricing results.</p>
            </div>
          </div>
          <div className="stack">
            {data.recentQuotes.length === 0 ? (
              <div className="emptyState">
                <strong>No quotes yet</strong>
              </div>
            ) : (
              data.recentQuotes.map((quote) => (
                <div className="detailCard" key={quote.id}>
                  <span>{quote.quoteNumber}</span>
                  <strong>{formatAdminMoney(quote.estimatedPrice)}</strong>
                  <p className="muted small">{formatDate(quote.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Recent orders</h2>
              <p className="muted">Order queue entries tied to this tenant.</p>
            </div>
          </div>
          <div className="stack">
            {data.recentOrders.length === 0 ? (
              <div className="emptyState">
                <strong>No orders yet</strong>
              </div>
            ) : (
              data.recentOrders.map((order) => (
                <div className="detailCard" key={order.id}>
                  <span>{order.orderNumber}</span>
                  <strong>{order.status}</strong>
                  <p className="muted small">{formatDate(order.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Recent activity</h2>
            <p className="muted">Audit trail for support and internal troubleshooting.</p>
          </div>
        </div>
        <div className="adminFeed">
          {data.recentActivity.map((entry) => (
            <div className="adminFeedItem" key={entry.id}>
              <div className="adminTone adminTone--info" aria-hidden="true" />
              <div style={{ flex: 1 }}>
                <div className="adminFeedMeta">
                  <strong>{entry.action}</strong>
                  <span className="badge">{entry.targetType ?? "Event"}</span>
                </div>
                <p className="muted small">{formatDate(entry.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </InternalAdminShell>
  );
}

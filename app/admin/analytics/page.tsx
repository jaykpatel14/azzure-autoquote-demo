import Link from "next/link";
import { redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav } from "@/lib/internal-admin-nav";
import { getAdminAnalytics } from "@/src/services/admin-analytics";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const context = await getInternalAdminContext();
  if (!context) {
    redirect("/signin");
  }

  const data = await getAdminAnalytics();

  return (
    <InternalAdminShell
      title="Platform analytics"
      description="High-level platform signals for quotes, orders, analyses, and tenant growth."
      navItems={getInternalAdminNav("/admin/analytics")}
      adminName={context.user.name || context.user.email}
      actions={
        <>
          <Link className="button secondary" href="/admin/orders">
            Orders
          </Link>
          <Link className="button secondary" href="/admin/tenants">
            Tenants
          </Link>
        </>
      }
    >
      <section className="statGrid">
        <article className="statCard statCard--admin">
          <span className="eyebrow">Tenants</span>
          <strong>{data.overview.tenants}</strong>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Quotes</span>
          <strong>{data.overview.quotes}</strong>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Orders</span>
          <strong>{data.overview.orders}</strong>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Analyses</span>
          <strong>{data.overview.analyses}</strong>
        </article>
        <article className="statCard statCard--admin"><span className="eyebrow">Showroom quotes</span><strong>{data.overview.showroomQuotes}</strong></article>
        <article className="statCard statCard--admin"><span className="eyebrow">Showroom claimed</span><strong>{data.overview.showroomClaimRate}%</strong></article>
        <article className="statCard statCard--admin"><span className="eyebrow">Showroom converted</span><strong>{data.overview.showroomConversionRate}%</strong></article>
      </section>

      <section className="grid twoUp">
        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Activity series</h2>
              <p className="muted">Rolling 14-day activity for core platform objects.</p>
            </div>
          </div>
          <div className="stack">
            {data.series.quotes.map((point) => (
              <div className="detailRow" key={`quotes-${point.day}`}>
                <span>{point.day}</span>
                <strong>{point.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Tenant leaders</h2>
              <p className="muted">The most active companies across quotes and orders.</p>
            </div>
          </div>
          <div className="stack">
            {data.topCompanies.map((company) => (
              <div className="detailCard" key={company.id}>
                <span>{company.slug}</span>
                <strong>{company.name}</strong>
                <p className="muted small">
                  {company.quoteCount} quotes · {company.orderCount} orders · {company.completedOrders} completed
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Status distribution</h2>
            <p className="muted">Subscription mix across the installed tenant base.</p>
          </div>
        </div>
        <div className="pricingGrid">
          {Object.entries(data.subscriptionsByStatus).map(([status, count]) => (
            <div className="detailCard" key={status}>
              <span>{status}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      </section>
    </InternalAdminShell>
  );
}

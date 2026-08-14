import Link from "next/link";
import { redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav } from "@/lib/internal-admin-nav";
import { formatAdminMoney, getAdminTenants } from "@/src/services/admin-tenants";

export const dynamic = "force-dynamic";

function formatDate(date: Date | null | undefined) {
  return date ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date) : "Never";
}

export default async function AdminTenantsPage() {
  const context = await getInternalAdminContext();
  if (!context) {
    redirect("/signin");
  }

  const data = await getAdminTenants();

  return (
    <InternalAdminShell
      title="Tenant management"
      description="Inspect every company, their subscription state, recent activity, and support-critical metadata."
      navItems={getInternalAdminNav("/admin/tenants")}
      adminName={context.user.name || context.user.email}
      actions={
        <>
          <Link className="button secondary" href="/admin/tenants/subscriptions">
            Subscriptions
          </Link>
          <Link className="button secondary" href="/admin/analytics">
            Analytics
          </Link>
          <Link className="button primary" href="/admin/tenants/new">
            Create tenant
          </Link>
        </>
      }
    >
      <section className="statGrid">
        <article className="statCard statCard--admin">
          <span className="eyebrow">Tenants</span>
          <strong>{data.stats.totalCompanies}</strong>
          <p className="muted small">Customer companies currently in the platform.</p>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Active subscriptions</span>
          <strong>{data.stats.activeSubscriptions}</strong>
          <p className="muted small">Trialing and live billing records.</p>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Pending approvals</span>
          <strong>{data.stats.pendingApprovals}</strong>
          <p className="muted small">New companies waiting for review.</p>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Quotes</span>
          <strong>{data.stats.totalQuotes}</strong>
          <p className="muted small">All tenant quotes in the system.</p>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Orders</span>
          <strong>{data.stats.totalOrders}</strong>
          <p className="muted small">Manufacturing orders across all tenants.</p>
        </article>
      </section>

      <section className="grid twoUp">
        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Tenant roster</h2>
              <p className="muted">Use this view to open billing, review activity, or start a support session.</p>
            </div>
            <Link className="button secondary" href="/admin/tenants/pending">
              Review approvals
            </Link>
          </div>
          <div className="tableShell">
            <table className="dataTable">
              <thead>
                <tr>
                  <th scope="col">Tenant</th>
                  <th scope="col">Approval</th>
                  <th scope="col">Plan</th>
                  <th scope="col">Status</th>
                  <th scope="col">Members</th>
                  <th scope="col">Recent value</th>
                </tr>
              </thead>
              <tbody>
                {data.companies.map((company) => (
                  <tr key={company.id}>
                    <td>
                      <strong>
                        <Link href={`/admin/tenants/${company.id}`}>{company.name}</Link>
                      </strong>
                      <p className="muted small">{company.slug}</p>
                    </td>
                    <td>
                      <span className="badge">{company.accountStatus.toLowerCase().replaceAll("_", " ")}</span>
                      <p className="muted small">{company.pricingTier ?? "No tier"}</p>
                    </td>
                    <td>{company.subscription?.plan.name ?? "No plan"}</td>
                    <td>
                      <span className="badge">{company.subscription?.status.toLowerCase() ?? "inactive"}</span>
                    </td>
                    <td>{company._count.memberships}</td>
                    <td>
                      {company.quotes[0] ? (
                        <>
                          <strong>{company.quotes[0].quoteNumber}</strong>
                          <p className="muted small">
                            {formatAdminMoney(company.quotes[0].estimatedPrice)} ·{" "}
                            {formatDate(company.quotes[0].createdAt)}
                          </p>
                        </>
                      ) : (
                        <span className="muted small">No quotes yet</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Recent support activity</h2>
              <p className="muted">Latest actions across tenant records and support workflows.</p>
            </div>
          </div>
          <div className="adminFeed">
            {data.recentActivity.map((entry) => (
              <div className="adminFeedItem" key={entry.id}>
                <div className="adminTone adminTone--info" aria-hidden="true" />
                <div style={{ flex: 1 }}>
                  <div className="adminFeedMeta">
                    <strong>{entry.companyName}</strong>
                    <span className="badge">{entry.action}</span>
                  </div>
                  <p className="muted small">{entry.description}</p>
                  <p className="muted small">{formatDate(entry.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </InternalAdminShell>
  );
}

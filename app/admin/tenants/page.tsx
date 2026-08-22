import Link from "next/link";
import { redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav, requireAdminRouteAccess } from "@/lib/internal-admin-nav";
import { formatAdminMoney, getAdminTenants } from "@/src/services/admin-tenants";

export const dynamic = "force-dynamic";

function formatDate(date: Date | null | undefined) {
  return date ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date)) : "Never";
}

export default async function AdminTenantsPage({ searchParams }: { searchParams?: Promise<{ plan?: string; status?: string; tier?: string; ck?: string }> }) {
  const context = await getInternalAdminContext();
  if (!context) {
    redirect("/signin");
  }

  requireAdminRouteAccess("/admin/tenants", context.user.adminRole );

  const data = await getAdminTenants();
  const filters = (await searchParams) ?? {};
  const companies = (data?.companies || []).filter((company) => {
    if (filters.plan && filters.plan !== "all" && company.subscription?.plan?.code !== filters.plan) return false;
    if (filters.status === "pending" && company.accountStatus !== "PENDING_APPROVAL") return false;
    if (filters.status && !["all", "pending"].includes(filters.status) && company.subscription?.status !== filters.status) return false;
    if (filters.tier === "unassigned" && company.pricingTier !== null) return false;
    if (filters.tier && !["all", "unassigned"].includes(filters.tier) && company.pricingTier !== filters.tier) return false;
    if (filters.ck === "verified" && !company.ckCustomerVerified) return false;
    if (filters.ck === "unverified" && company.ckCustomerVerified) return false;
    return true;
  });

  return (
    <InternalAdminShell
      title="Tenant management"
      description="Inspect every company, their subscription state, recent activity, and support-critical metadata."
      navItems={getInternalAdminNav("/admin/tenants", context.user.adminRole )}
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
          <strong>{data?.stats?.totalCompanies ?? 0}</strong>
          <p className="muted small">Customer companies currently in the platform.</p>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Active subscriptions</span>
          <strong>{data?.stats?.activeSubscriptions ?? 0}</strong>
          <p className="muted small">Trialing and live billing records.</p>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Pending approvals</span>
          <strong>{data?.stats?.pendingApprovals ?? 0}</strong>
          <p className="muted small">New companies waiting for review.</p>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Quotes</span>
          <strong>{data?.stats?.totalQuotes ?? 0}</strong>
          <p className="muted small">All tenant quotes in the system.</p>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Orders</span>
          <strong>{data?.stats?.totalOrders ?? 0}</strong>
          <p className="muted small">Manufacturing orders across all tenants.</p>
        </article>
      </section>

      <section className="grid twoUp">
        <article className="card">
          <form className="quotesToolbar" method="get">
            <label>Plan <select name="plan" defaultValue={filters.plan ?? "all"}><option value="all">All</option><option value="starter">Starter</option><option value="professional">Professional</option><option value="enterprise">Enterprise</option></select></label>
            <label>Status <select name="status" defaultValue={filters.status ?? "all"}><option value="all">All</option><option value="ACTIVE">Active</option><option value="TRIALING">Trial</option><option value="PAST_DUE">Past due</option><option value="CANCELED">Cancelled</option><option value="pending">Pending approval</option></select></label>
            <label>Tier <select name="tier" defaultValue={filters.tier ?? "all"}><option value="all">All</option><option value="TIER_1">Tier 1</option><option value="TIER_2">Tier 2</option><option value="TIER_3">Tier 3</option><option value="unassigned">Unassigned</option></select></label>
            <label>CK <select name="ck" defaultValue={filters.ck ?? "all"}><option value="all">All</option><option value="verified">Verified</option><option value="unverified">Not verified</option></select></label>
            <button className="button secondary button--sm" type="submit">Apply filters</button>
          </form>
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
                  <th scope="col">Tier</th>
                  <th scope="col">CK verified</th>
                  <th scope="col">Status</th>
                  <th scope="col">Members</th>
                  <th scope="col">Recent value</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company.id}>
                    <td>
                      <strong>
                        <Link href={`/admin/tenants/${company.id}`}>{company.name}</Link>
                      </strong>
                      <p className="muted small">{company.slug}</p>
                    </td>
                    <td>
                      <span className="badge">{company.accountStatus?.toLowerCase().replaceAll("_", " ")}</span>
                      <p className="muted small">{company.pricingTier ?? "No tier"}</p>
                    </td>
                    <td>{company.subscription?.plan?.name ?? "No plan"}</td>
                    <td><span className="badge">{company.pricingTier?.replace("TIER_", "Tier ") ?? "Unassigned"}</span></td>
                    <td>{company.ckCustomerVerified ? "✓" : <span className="muted">—</span>}</td>
                    <td>
                      <span className="badge">{company.subscription?.status?.toLowerCase() ?? "inactive"}</span>
                    </td>
                    <td>{company._count?.memberships ?? 0}</td>
                    <td>
                      {company.quotes?.[0] ? (
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
              <h2>Recent activity</h2>
              <p className="muted">Latest audit events across all companies.</p>
            </div>
          </div>
          <div className="adminFeed">
            {(data?.recentActivity || []).map((entry) => (
              <div className="adminFeedItem" key={entry.id}>
                <div className="adminTone adminTone--info" aria-hidden="true" />
                <div style={{ flex: 1 }}>
                  <div className="adminFeedMeta">
                    <strong>{entry.action}</strong>
                    <span className="badge">{entry.companyName}</span>
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

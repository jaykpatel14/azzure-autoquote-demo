import Link from "next/link";
import { redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav } from "@/lib/internal-admin-nav";
import { getAdminOverviewData } from "@/src/services/admin-overview";

export const dynamic = "force-dynamic";

function formatRelativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  if (diffMinutes < 60) return `${Math.max(1, diffMinutes)}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function toneClass(tone: "success" | "warning" | "error" | "info") {
  switch (tone) {
    case "success":
      return "adminTone adminTone--success";
    case "warning":
      return "adminTone adminTone--warning";
    case "error":
      return "adminTone adminTone--error";
    default:
      return "adminTone adminTone--info";
  }
}

function healthToneClass(state: "operational" | "degraded" | "down") {
  switch (state) {
    case "operational":
      return "adminTone adminTone--success";
    case "degraded":
      return "adminTone adminTone--warning";
    case "down":
      return "adminTone adminTone--error";
  }
}

export default async function AdminDashboardPage() {
  const context = await getInternalAdminContext();
  if (!context) {
    redirect("/signin");
  }

  const overview = await getAdminOverviewData();

  return (
    <InternalAdminShell
      title="Operations dashboard"
      description="Monitor platform health, live revenue, and the most important events across all tenants."
      navItems={getInternalAdminNav("/admin")}
      adminName={context.user.name || context.user.email}
      actions={
        <>
          <Link className="button secondary" href="/admin/tenants">
            Tenants
          </Link>
          <Link className="button primary" href="/admin/platform/settings">
            Platform settings
          </Link>
        </>
      }
    >
      <section className="statGrid">
        {overview.stats.map((stat) => (
          <article className="statCard statCard--admin" key={stat.label}>
            <span className="eyebrow">{stat.label}</span>
            <strong>{stat.value}</strong>
            <p className="muted small">{stat.subtext}</p>
          </article>
        ))}
      </section>

      <section className="grid twoUp">
        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Platform activity feed</h2>
              <p className="muted">The most recent events across tenants, billing, and system hooks.</p>
            </div>
          </div>
          <div className="adminFeed" aria-label="Platform activity feed">
            {overview.feed.length === 0 ? (
              <div className="emptyState">
                <strong>No activity yet</strong>
                <p className="muted">Events will appear here as tenants sign up, quote, and place orders.</p>
              </div>
            ) : (
              overview.feed.map((item) => (
                <Link key={item.id} href={item.href ?? "/admin"} className="adminFeedItem">
                  <span className={toneClass(item.tone)} aria-hidden="true" />
                  <div>
                    <div className="adminFeedMeta">
                      <strong>{item.label}</strong>
                      <span className="muted small">{formatRelativeTime(item.occurredAt)}</span>
                    </div>
                    <p className="muted">{item.description}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </article>

        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Platform health</h2>
              <p className="muted">Quick status checks for the services this console relies on.</p>
            </div>
          </div>
          <div className="adminHealthList">
            {overview.health.map((item) => (
              <div key={item.label} className="adminHealthRow">
                <div className={healthToneClass(item.state)} aria-hidden="true" />
                <div>
                  <strong>{item.label}</strong>
                  <p className="muted small">{item.detail}</p>
                </div>
                <span className="badge">{item.state}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Admin shortcuts</h2>
            <p className="muted">Common support routes for the Azzure team.</p>
          </div>
        </div>
        <div className="pricingGrid">
          <Link className="detailCard" href="/admin/tenants">
            <span>Tenants</span>
            <strong>Review all companies</strong>
            <p className="muted small">Jump into a tenant record for billing, usage, or support work.</p>
          </Link>
          <Link className="detailCard" href="/admin/tenants/subscriptions">
            <span>Subscriptions</span>
            <strong>Billing health and pricing</strong>
            <p className="muted small">Inspect plans, usage windows, and subscription records.</p>
          </Link>
          <Link className="detailCard" href="/admin/platform/api-keys">
            <span>API keys</span>
            <strong>Shared API keys</strong>
            <p className="muted small">Rotate provider keys and update runtime defaults.</p>
          </Link>
        </div>
      </section>
    </InternalAdminShell>
  );
}

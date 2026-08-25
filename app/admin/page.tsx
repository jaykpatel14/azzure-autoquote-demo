import Link from "next/link";
import { redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav, requireAdminRouteAccess } from "@/lib/internal-admin-nav";
import { getAdminOverviewData } from "@/src/services/admin-overview";
import { resolveMetalPricing } from "@/lib/metal-pricing";

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

function healthBadge(state: "operational" | "degraded" | "down") {
  switch (state) {
    case "operational":
      return (
        <span className="badge" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.25)", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
          Operational
        </span>
      );
    case "degraded":
      return (
        <span className="badge" style={{ background: "rgba(245, 158, 11, 0.12)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.25)", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b" }} />
          Degraded
        </span>
      );
    case "down":
      return (
        <span className="badge" style={{ background: "rgba(239, 68, 68, 0.12)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.25)", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444" }} />
          Down
        </span>
      );
  }
}

export default async function AdminDashboardPage() {
  const context = await getInternalAdminContext();
  if (!context) {
    redirect("/signin");
  }

  requireAdminRouteAccess("/admin", context.user.adminRole );

  let overview;
  let livePricing;

  try {
    [overview, livePricing] = await Promise.all([
      getAdminOverviewData(),
      resolveMetalPricing()
    ]);
  } catch (err) {
    console.error("[admin/page] Failed to load overview metrics:", err);
    overview = {
      stats: [
        { label: "Active tenants", value: "—", subtext: "Platform metrics loading" },
        { label: "Quotes today", value: "—", subtext: "across all tenants" },
        { label: "Open orders", value: "—", subtext: "submitted / in production" },
        { label: "MRR", value: "$0", subtext: "live Stripe subscription total" },
        { label: "Churn this month", value: "0", subtext: "Stripe cancellations this month" }
      ],
      feed: [],
      health: [],
      pendingApprovals: 0,
      ordersNeedingCkId: 0
    };
    livePricing = await resolveMetalPricing().catch(() => ({
      source: "fallback" as const,
      pricingProfile: {
        goldSpotPerOz: 4500,
        platinumSpotPerOz: 2000,
        silverSpotPerOz: 100
      },
      message: "Standard rates active"
    }));
  }

  return (
    <InternalAdminShell
      title="Operations Dashboard"
      description="Monitor platform health, live revenue, and tenant activity across Azzure AI Quote."
      navItems={getInternalAdminNav("/admin", context.user.adminRole )}
      adminName={context.user.name || context.user.email}
      actions={
        <>
          <Link className="button secondary button--sm" href="/admin/tenants">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>store</span>
            Tenants
          </Link>
          <Link className="button primary button--sm" href="/admin/platform/settings">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>settings</span>
            Platform Settings
          </Link>
        </>
      }
    >
      {/* ── Banners ── */}
      {overview.pendingApprovals > 0 ? (
        <section className="warningBanner" style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.25)", padding: 16, borderRadius: "var(--radius-lg)", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="material-symbols-outlined" style={{ color: "#f59e0b", fontSize: 24 }}>how_to_reg</span>
            <div>
              <strong style={{ fontSize: "var(--text-base)" }}>{overview.pendingApprovals} account{overview.pendingApprovals === 1 ? " is" : "s are"} waiting for approval</strong>
              <p className="muted small" style={{ margin: "2px 0 0" }}>Jewelers cannot use Azzure AI Quote until approved by an administrator.</p>
            </div>
            <Link className="button primary button--sm" href="/admin/tenants/pending" style={{ marginLeft: "auto" }}>
              Review Accounts
            </Link>
          </div>
        </section>
      ) : null}

      {overview.ordersNeedingCkId > 0 ? (
        <section className="warningBanner" style={{ background: "rgba(14, 165, 233, 0.08)", border: "1px solid rgba(14, 165, 233, 0.25)", padding: 16, borderRadius: "var(--radius-lg)", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="material-symbols-outlined" style={{ color: "#0ea5e9", fontSize: 24 }}>precision_manufacturing</span>
            <div>
              <strong style={{ fontSize: "var(--text-base)" }}>{overview.ordersNeedingCkId} order{overview.ordersNeedingCkId === 1 ? " is" : "s are"} waiting for Custom King Production ID</strong>
              <p className="muted small" style={{ margin: "2px 0 0" }}>Jewelers cannot track manufacturing until an ID is assigned.</p>
            </div>
            <Link className="button secondary button--sm" href="/admin/orders" style={{ marginLeft: "auto" }}>
              Order Queue
            </Link>
          </div>
        </section>
      ) : null}

      {/* ── Key Performance Indicators Grid ── */}
      <section className="statGrid">
        {overview.stats.map((stat) => (
          <article className="statCard statCard--admin" key={stat.label}>
            <span className="eyebrow">{stat.label}</span>
            <strong style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", fontWeight: 700 }}>{stat.value}</strong>
            <p className="muted small">{stat.subtext}</p>
          </article>
        ))}
      </section>

      {/* ── Activity Feed & System Health ── */}
      <section className="grid twoUp" style={{ marginTop: 24 }}>
        {/* Activity Feed */}
        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Platform Activity Feed</h2>
              <p className="muted small">Real-time tenant signups, quotes, and webhooks.</p>
            </div>
          </div>
          <div className="adminFeed" aria-label="Platform activity feed">
            {overview.feed.length === 0 ? (
              <div className="emptyState">
                <strong>No activity yet</strong>
                <p className="muted small">Events will appear here as tenants sign up and create quotes.</p>
              </div>
            ) : (
              overview.feed.map((item) => (
                <Link key={item.id} href={item.href ?? "/admin"} className="adminFeedItem">
                  <span className={`adminTone adminTone--${item.tone}`} aria-hidden="true" />
                  <div style={{ flex: 1 }}>
                    <div className="adminFeedMeta">
                      <strong>{item.label}</strong>
                      <span className="muted small">{formatRelativeTime(item.occurredAt)}</span>
                    </div>
                    <p className="muted small" style={{ margin: "2px 0 0" }}>{item.description}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </article>

        {/* Platform Health Status */}
        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Platform Health &amp; Services</h2>
              <p className="muted small">Status checks for AI, market feeds, database, and Stripe.</p>
            </div>
          </div>
          <div className="adminHealthList">
            {overview.health.map((item) => (
              <div key={item.label} className="adminHealthRow" style={{ padding: "12px 16px" }}>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: "var(--text-sm)", display: "block" }}>{item.label}</strong>
                  <span className="muted small">{item.detail}</span>
                </div>
                {healthBadge(item.state)}
              </div>
            ))}
          </div>
        </article>
      </section>

      {/* ── Live Precious Metal Market Feeds ── */}
      <section className="card" style={{ marginTop: 24 }}>
        <div className="sectionHeader">
          <div>
            <h2>Precious Metal Spot Market Feeds</h2>
            <p className="muted small">Live market spot prices from Metals.dev used in all retail quote calculations.</p>
          </div>
        </div>
        <div className="pricingGrid">
          <div className="detailCard" style={{ borderLeft: "3px solid #f59e0b" }}>
            <span className="eyebrow" style={{ color: "#d97706" }}>XAU · Fine Gold (24K)</span>
            <strong style={{ fontSize: "1.75rem", fontFamily: "var(--font-display, Georgia, serif)" }}>
              ${Number(livePricing.pricingProfile.goldSpotPerOz).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              <span style={{ fontSize: "1rem", fontWeight: 400, color: "var(--color-on-surface-variant)" }}> / oz</span>
            </strong>
            <p className="muted small" style={{ marginTop: 4 }}>
              14K: ~${(Number(livePricing.pricingProfile.goldSpotPerOz) / 31.1035 * 0.585).toFixed(2)}/g
            </p>
          </div>

          <div className="detailCard" style={{ borderLeft: "3px solid #94a3b8" }}>
            <span className="eyebrow" style={{ color: "#64748b" }}>XPT · Pure Platinum</span>
            <strong style={{ fontSize: "1.75rem", fontFamily: "var(--font-display, Georgia, serif)" }}>
              ${Number(livePricing.pricingProfile.platinumSpotPerOz).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              <span style={{ fontSize: "1rem", fontWeight: 400, color: "var(--color-on-surface-variant)" }}> / oz</span>
            </strong>
            <p className="muted small" style={{ marginTop: 4 }}>
              950 Plat: ~${(Number(livePricing.pricingProfile.platinumSpotPerOz) / 31.1035).toFixed(2)}/g
            </p>
          </div>

          <div className="detailCard" style={{ borderLeft: "3px solid #cbd5e1" }}>
            <span className="eyebrow" style={{ color: "#64748b" }}>XAG · Sterling Silver</span>
            <strong style={{ fontSize: "1.75rem", fontFamily: "var(--font-display, Georgia, serif)" }}>
              ${Number(livePricing.pricingProfile.silverSpotPerOz).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              <span style={{ fontSize: "1rem", fontWeight: 400, color: "var(--color-on-surface-variant)" }}> / oz</span>
            </strong>
            <p className="muted small" style={{ marginTop: 4 }}>
              925 Silver: ~${(Number(livePricing.pricingProfile.silverSpotPerOz) / 31.1035).toFixed(2)}/g
            </p>
          </div>

          <div className="detailCard" style={{ borderLeft: "3px solid #0284c7" }}>
            <span className="eyebrow" style={{ color: "#0284c7" }}>Feed Status &amp; Cache</span>
            <strong style={{ fontSize: "1.25rem" }}>
              {livePricing.source === "metals.dev" ? "🟢 Live API Stream" : "🟡 Cached Fallback"}
            </strong>
            <p className="muted small" style={{ marginTop: 4 }}>
              {livePricing.message || "Daily spot rate auto-refreshed."}
            </p>
          </div>
        </div>
      </section>

      {/* ── Operations Shortcuts ── */}
      <section className="card" style={{ marginTop: 24 }}>
        <div className="sectionHeader">
          <div>
            <h2>Admin Operations Shortcuts</h2>
            <p className="muted small">Quick navigation for tenant management and platform settings.</p>
          </div>
        </div>
        <div className="pricingGrid">
          <Link className="detailCard" href="/admin/tenants" style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span className="material-symbols-outlined" style={{ color: "var(--color-primary)" }}>store</span>
              <strong style={{ fontSize: "var(--text-base)" }}>Tenants</strong>
            </div>
            <p className="muted small">Jump into a tenant record for billing, usage, or support work.</p>
          </Link>

          <Link className="detailCard" href="/admin/tenants/subscriptions" style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span className="material-symbols-outlined" style={{ color: "var(--color-primary)" }}>credit_card</span>
              <strong style={{ fontSize: "var(--text-base)" }}>Subscriptions</strong>
            </div>
            <p className="muted small">Inspect plans, MRR windows, and subscription records.</p>
          </Link>

          <Link className="detailCard" href="/admin/tenants/pending" style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span className="material-symbols-outlined" style={{ color: "var(--color-primary)" }}>how_to_reg</span>
              <strong style={{ fontSize: "var(--text-base)" }}>Approvals</strong>
            </div>
            <p className="muted small">Approve pending companies and assign pricing tiers.</p>
          </Link>

          <Link className="detailCard" href="/admin/platform/api-keys" style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span className="material-symbols-outlined" style={{ color: "var(--color-primary)" }}>key</span>
              <strong style={{ fontSize: "var(--text-base)" }}>Shared API Keys</strong>
            </div>
            <p className="muted small">Rotate provider keys and update runtime defaults.</p>
          </Link>
        </div>
      </section>
    </InternalAdminShell>
  );
}

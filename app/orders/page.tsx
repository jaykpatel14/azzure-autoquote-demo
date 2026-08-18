import Link from "next/link";
import { redirect } from "next/navigation";
import WorkspaceShell from "@/components/workspace-shell";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { getWorkspaceNav } from "@/lib/workspace-nav";
import { getOrdersOverview } from "@/src/services/orders";
import { StatusBadge } from "@/src/components/ui/StatusBadge";

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

export default async function OrdersPage() {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  if (context.company.subscription && !context.company.subscription.onboardingComplete) {
    redirect("/onboarding");
  }

  const canPlaceOrders = context.company.accountStatus === "APPROVED" && context.company.ckCustomerVerified;
  const overview = await getOrdersOverview(context.company.id);

  return (
    <WorkspaceShell
      title="Manufacturing Orders [Staging Feature]"
      description="Track submitted jobs, in-production work, and staging order dispatches."
      navItems={getWorkspaceNav("/orders")}
      actions={
        <Link className="button secondary button--sm" href="/quotes">
          View Quotes
        </Link>
      }
    >
      {/* ── Staging Notice Banner ── */}
      <section className="warningBanner" style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.3)", padding: 18, borderRadius: "var(--radius-lg)", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="material-symbols-outlined" style={{ color: "#f59e0b", fontSize: 24 }}>engineering</span>
          <div>
            <strong style={{ fontSize: "var(--text-base)", color: "var(--color-on-surface)" }}>
              CustomKing Manufacturing Orders — Staging Feature Mode
            </strong>
            <p className="muted small" style={{ margin: "2px 0 0" }}>
              Quotes, Live Metal Spot Pricing, Showroom Kiosks, and PDF Exports are Live. CustomKing Manufacturing Integration is restricted to Staging/Dev mode until explicit go-ahead is granted.
            </p>
          </div>
        </div>
      </section>

      {!canPlaceOrders ? (
        <section className="card">
          <div className="sectionHeader">
            <div>
              <h2>Custom King verification required</h2>
              <p className="muted">
                Manufacturing orders are only available after your Azzure account is approved and verified with Custom King.
              </p>
            </div>
          </div>
          <div className="heroActions">
            <Link className="button secondary" href="/settings">
              Review account
            </Link>
            <a className="button secondary" href="mailto:support@azzuresolutions.com">
              Contact support
            </a>
          </div>
        </section>
      ) : null}

      <section className="statGrid">
        <article className="statCard">
          <span className="eyebrow">Submitted (Staging)</span>
          <strong>{overview.counts.SUBMITTED}</strong>
          <p className="muted small">Ready to be sent to manufacturing.</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">CK placed (Staging)</span>
          <strong>{overview.counts.CK_ORDER_PLACED}</strong>
          <p className="muted small">Accepted by Custom King and waiting on production.</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">In production</span>
          <strong>{overview.counts.IN_PRODUCTION}</strong>
          <p className="muted small">Jobs actively being made.</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Completed</span>
          <strong>{overview.counts.COMPLETED}</strong>
          <p className="muted small">Finished and ready for delivery.</p>
        </article>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Orders dashboard (Staging Queue)</h2>
            <p className="muted">Open orders from finalized quotes. Cancelation is only available while the order is still active.</p>
          </div>
        </div>
        {overview.recentOrders.length === 0 ? (
          <div className="emptyState">
            <strong>No orders submitted yet</strong>
            <p className="muted">Place your first staging manufacturing order from a finalized quote.</p>
            <Link className="button primary" href="/quotes">
              View quotes
            </Link>
          </div>
        ) : (
          <div className="tableShell">
            <table className="dataTable ordersTable">
              <thead>
                <tr>
                  <th scope="col">Order #</th>
                  <th scope="col">Quote ref</th>
                  <th scope="col">Item</th>
                  <th scope="col">Status</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">Last updated</th>
                </tr>
              </thead>
              <tbody>
                {overview.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="monoCell">
                      <Link className="rowLink" href={`/orders/${order.id}`}>
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td>
                      <Link className="rowLink" href="/quotes">
                        {order.quoteNumber}
                      </Link>
                    </td>
                    <td>
                      <Link className="rowLink" href={`/orders/${order.id}`}>
                        {order.itemName}
                      </Link>
                    </td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td title={order.submittedAt.toLocaleString()}>{formatRelativeTime(order.submittedAt)}</td>
                    <td title={order.updatedAt.toLocaleString()}>{formatRelativeTime(order.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </WorkspaceShell>
  );
}

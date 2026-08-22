import Link from "next/link";
import { redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { AdminThumbImage } from "@/components/admin-thumb-image";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav } from "@/lib/internal-admin-nav";
import { ADMIN_ORDER_STATUSES, getAdminOrders } from "@/src/services/admin-orders";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default async function AdminOrdersPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const context = await getInternalAdminContext();
  if (!context) {
    redirect("/signin");
  }

  const data = await getAdminOrders("all");
  const tab = (await searchParams)?.tab ?? "needs-ck";
  const needsCkCount = data.orders.filter((order) => order.status === "SUBMITTED" && !order.ckOrderId).length;
  const productionCount = data.orders.filter(
    (order) => Boolean(order.ckOrderId) && order.status !== "COMPLETED" && !["CANCELED", "CANCELLED"].includes(order.status)
  ).length;
  const orders = data.orders.filter((order) => {
    if (tab === "needs-ck") return order.status === "SUBMITTED" && !order.ckOrderId;
    if (tab === "production") return Boolean(order.ckOrderId) && order.status !== "COMPLETED" && !["CANCELED", "CANCELLED"].includes(order.status);
    if (tab === "completed") return order.status === "COMPLETED";
    if (tab === "cancelled") return ["CANCELED", "CANCELLED"].includes(order.status);
    return true;
  }).sort((a, b) => {
    if (tab !== "needs-ck") return 0;
    return (a.submittedAt?.getTime() ?? a.createdAt.getTime()) - (b.submittedAt?.getTime() ?? b.createdAt.getTime());
  });

  return (
    <InternalAdminShell
      title="Manufacturing Order Queue"
      description="Track order status, hand work to production, and test CustomKing dispatches."
      navItems={getInternalAdminNav("/admin/orders")}
      adminName={context.user.name || context.user.email}
      actions={
        <>
          <Link className="button secondary button--sm" href="/admin/analytics">
            Analytics
          </Link>
          <Link className="button secondary button--sm" href="/admin/tenants">
            Tenants
          </Link>
        </>
      }
    >
      <section className="statGrid">
        <article className="statCard statCard--admin">
          <span className="eyebrow">Total</span>
          <strong>{data.counts.total}</strong>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Submitted</span>
          <strong>{data.counts.submitted}</strong>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">CK placed</span>
          <strong>{data.counts.ckOrderPlaced}</strong>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">In production</span>
          <strong>{data.counts.inProduction}</strong>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Completed</span>
          <strong>{data.counts.completed}</strong>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Cancelled</span>
          <strong>{data.counts.cancelled}</strong>
        </article>
      </section>

      <section className="card">
        <nav className="quoteTabs" aria-label="Order queue filters" role="tablist">
          <Link role="tab" aria-selected={tab === "needs-ck"} className={`quoteTab${tab === "needs-ck" ? " isActive" : ""}`} href="/admin/orders?tab=needs-ck">Needs CK order ID ({needsCkCount})</Link>
          <Link role="tab" aria-selected={tab === "production"} className={`quoteTab${tab === "production" ? " isActive" : ""}`} href="/admin/orders?tab=production">In production ({productionCount})</Link>
          <Link role="tab" aria-selected={tab === "completed"} className={`quoteTab${tab === "completed" ? " isActive" : ""}`} href="/admin/orders?tab=completed">Completed ({data.counts.completed})</Link>
          <Link role="tab" aria-selected={tab === "cancelled"} className={`quoteTab${tab === "cancelled" ? " isActive" : ""}`} href="/admin/orders?tab=cancelled">Cancelled ({data.counts.cancelled})</Link>
        </nav>
        <div className="sectionHeader">
          <div>
            <h2>Order Queue</h2>
            <p className="muted">Review and manage all manufacturing orders.</p>
          </div>
        </div>
        <div className="tableShell">
          <table className="dataTable">
            <thead>
              <tr>
                <th scope="col" style={{ width: "64px" }}>Design</th>
                <th scope="col">Order</th>
                <th scope="col">Company</th>
                <th scope="col">Status</th>
                <th scope="col">Quote</th>
                <th scope="col">Specs</th>
                <th scope="col">Making price</th>
                <th scope="col">Customer price</th>
                <th scope="col">Updated</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link href={`/admin/orders/${order.id}`}>
                      <div
                        style={{
                          width: "52px",
                          height: "52px",
                          borderRadius: "8px",
                          overflow: "hidden",
                          background: "#F8FAFC",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1px solid #E2E8F0",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                          position: "relative"
                        }}
                      >
                        <AdminThumbImage
                          src={`/api/admin/orders/${order.id}/image`}
                          alt={order.itemName || "Jewelry design"}
                        />
                      </div>
                    </Link>
                  </td>
                  <td>
                    <strong>
                      <Link href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link>
                    </strong>
                    <p className="muted small">{order.itemName}</p>
                  </td>
                  <td>
                    <Link className="textLink" href={`/admin/tenants/${order.company.id}`}>
                      {order.company.name}
                    </Link>
                  </td>
                  <td>
                    <span className="badge">{order.status}</span>
                  </td>
                  <td>
                    <Link className="textLink" href={`/admin/quotes/${order.quote?.id || ""}`}>
                      {order.quote?.quoteNumber || "—"}
                    </Link>
                  </td>
                  <td>
                    <p className="muted small" style={{ margin: 0, fontWeight: 600, color: "#1E293B" }}>
                      {order.quote?.metalType || "14K"}
                    </p>
                    <p className="muted small" style={{ margin: 0 }}>
                      {order.quote?.analysis?.centerShape ? `${order.quote.analysis.centerShape} ` : ""}
                      {order.quote?.analysis?.jewelryType || "Jewelry"}
                    </p>
                  </td>
                  <td>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(order.quote?.makingPrice ?? 0))}</td>
                  <td>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(order.quote?.estimatedSellingPrice ?? order.quote?.estimatedPrice ?? 0))}</td>
                  <td>{formatDate(order.updatedAt)}</td>
                  <td>
                    <Link className="button secondary button--sm" href={`/admin/orders/${order.id}`} style={{ padding: "4px 8px", fontSize: "12px" }}>
                      {order.status === "SUBMITTED" && !order.ckOrderId ? "Assign CK" : "Review"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </InternalAdminShell>
  );
}

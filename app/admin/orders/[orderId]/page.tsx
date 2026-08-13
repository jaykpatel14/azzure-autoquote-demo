import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrderStatus } from "@prisma/client";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav } from "@/lib/internal-admin-nav";
import { getAdminOrder } from "@/src/services/admin-orders";

type OrderPageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

function formatDate(date: Date | null | undefined) {
  return date ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date) : "Not set";
}

export const dynamic = "force-dynamic";

export default async function AdminOrderPage({ params }: OrderPageProps) {
  const context = await getInternalAdminContext();
  if (!context) {
    redirect("/signin");
  }

  const { orderId } = await params;
  const order = await getAdminOrder(orderId);
  if (!order) {
    notFound();
  }

  return (
    <InternalAdminShell
      title={order.orderNumber}
      description="Review and update the order from intake through completed production."
      navItems={getInternalAdminNav("/admin/orders")}
      adminName={context.user.name || context.user.email}
      actions={
        <>
          <Link className="button secondary" href="/admin/orders">
            Back to queue
          </Link>
          <Link className="button secondary" href={`/admin/tenants/${order.companyId}`}>
            Open tenant
          </Link>
        </>
      }
    >
      <section className="statGrid">
        <article className="statCard statCard--admin">
          <span className="eyebrow">Status</span>
          <strong>{order.status}</strong>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Submitted</span>
          <strong>{formatDate(order.submittedAt)}</strong>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Reviewed</span>
          <strong>{formatDate(order.reviewedAt)}</strong>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Completed</span>
          <strong>{formatDate(order.completedAt)}</strong>
        </article>
      </section>

      <section className="grid twoUp">
        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Order detail</h2>
              <p className="muted">Production tracking and support notes.</p>
            </div>
          </div>
          <div className="stack">
            <div className="detailCard">
              <span>Tenant</span>
              <strong>{order.company.name}</strong>
              <p className="muted small">{order.company.slug}</p>
            </div>
            <div className="detailCard">
              <span>Item</span>
              <strong>{order.itemName}</strong>
            </div>
            <div className="detailCard">
              <span>Quote</span>
              <strong>{order.quote.quoteNumber}</strong>
              <p className="muted small">
                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                  Number(order.quote.estimatedPrice)
                )}
              </p>
            </div>
            <div className="detailCard">
              <span>Notes</span>
              <strong>{order.notes || "No notes"}</strong>
            </div>
          </div>
        </article>

        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Update status</h2>
              <p className="muted">Move the order through the production workflow.</p>
            </div>
          </div>
          <form className="stack" action={`/api/admin/orders/${order.id}`} method="post">
            <input type="hidden" name="redirectTo" value={`/admin/orders/${order.id}`} />
            <label className="field">
              <span>Status</span>
              <select name="status" defaultValue={order.status}>
                {Object.values(OrderStatus).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea name="notes" rows={6} defaultValue={order.notes ?? ""} placeholder="Add internal support notes" />
            </label>
            <div className="heroActions">
              <button className="button primary" type="submit">
                Save order
              </button>
            </div>
          </form>
          <div className="detailCard" style={{ marginTop: "1rem" }}>
            <span>Timeline</span>
            <strong>{formatDate(order.submittedAt)}</strong>
            <p className="muted small">Submitted</p>
            <p className="muted small">Reviewed: {formatDate(order.reviewedAt)}</p>
            <p className="muted small">Production: {formatDate(order.productionAt)}</p>
            <p className="muted small">Completed: {formatDate(order.completedAt)}</p>
          </div>
        </article>
      </section>
    </InternalAdminShell>
  );
}

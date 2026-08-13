import Link from "next/link";
import { redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav } from "@/lib/internal-admin-nav";
import { ADMIN_ORDER_STATUSES, getAdminOrders } from "@/src/services/admin-orders";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default async function AdminOrdersPage() {
  const context = await getInternalAdminContext();
  if (!context) {
    redirect("/signin");
  }

  const data = await getAdminOrders("all");

  return (
    <InternalAdminShell
      title="Manufacturing order queue"
      description="Track order status, hand work to production, and jump to the tenant that submitted the order."
      navItems={getInternalAdminNav("/admin/orders")}
      adminName={context.user.name || context.user.email}
      actions={
        <>
          <Link className="button secondary" href="/admin/analytics">
            Analytics
          </Link>
          <Link className="button secondary" href="/admin/tenants">
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
          <span className="eyebrow">In production</span>
          <strong>{data.counts.inProduction}</strong>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Completed</span>
          <strong>{data.counts.completed}</strong>
        </article>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Order queue</h2>
            <p className="muted">Every order is editable from this queue view.</p>
          </div>
        </div>
        <div className="tableShell">
          <table className="dataTable">
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Company</th>
                <th scope="col">Status</th>
                <th scope="col">Quote</th>
                <th scope="col">Updated</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.map((order) => (
                <tr key={order.id}>
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
                  <td>{order.quote.quoteNumber}</td>
                  <td>{formatDate(order.updatedAt)}</td>
                  <td>
                    <Link className="textLink" href={`/admin/orders/${order.id}`}>
                      Review order
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

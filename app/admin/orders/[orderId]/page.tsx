import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrderStatus } from "@prisma/client";
import InternalAdminShell from "@/components/internal-admin-shell";
import { AdminThumbImage } from "@/components/admin-thumb-image";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav, requireAdminRouteAccess } from "@/lib/internal-admin-nav";
import { getAdminOrder } from "@/src/services/admin-orders";

type OrderPageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

function formatDate(date: Date | null | undefined) {
  return date ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date)) : "Not set";
}

export const dynamic = "force-dynamic";

export default async function AdminOrderPage({ params }: OrderPageProps) {
  const context = await getInternalAdminContext();
  if (!context) {
    redirect("/signin");
  }

  requireAdminRouteAccess("/admin/orders", context.user.adminRole );

  const { orderId } = await params;
  const order = await getAdminOrder(orderId);
  if (!order) {
    notFound();
  }

  const quote = order.quote;
  const analysis = quote?.analysis;

  return (
    <InternalAdminShell
      title={order.orderNumber}
      description="Review and update the order from intake through completed production."
      navItems={getInternalAdminNav("/admin/orders", context.user.adminRole )}
      adminName={context.user.name || context.user.email}
      actions={
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Link className="button secondary" href="/admin/orders">
            Back to queue
          </Link>
          <Link className="button secondary" href={`/admin/tenants/${order.companyId}`}>
            Open tenant
          </Link>
          {quote ? (
            <Link className="button secondary" href={`/admin/quotes/${quote.id}`}>
              Audit quote
            </Link>
          ) : null}
        </div>
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

      {/* Visual Design & Jewelry Specs Card */}
      <section className="card" style={{ marginBottom: "1.5rem" }}>
        <div className="sectionHeader">
          <div>
            <h2>Jewelry Design & Visual Specifications</h2>
            <p className="muted">AI presentation rendering and manufacturing parameters for this custom piece.</p>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 360px) 1fr", gap: "24px", alignItems: "start" }}>
          {/* Hero Thumbnail / Picture */}
          <div
            style={{
              borderRadius: "12px",
              overflow: "hidden",
              background: "#08090C",
              border: "1px solid #E2E8F0",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "320px",
              position: "relative"
            }}
          >
            <AdminThumbImage
              src={`/api/admin/orders/${order.id}/image`}
              alt={order.itemName || "Jewelry design render"}
              fallback="💎"
            />
          </div>

          {/* Extracted Specifications Grid */}
          <div className="stack">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
              <div className="detailCard">
                <span>Item Name</span>
                <strong>{order.itemName}</strong>
                <p className="muted small">{analysis?.jewelryType || "Custom Jewelry"}</p>
              </div>

              <div className="detailCard">
                <span>Metal Alloy & Weight</span>
                <strong>{quote?.metalType || "14K Gold"}</strong>
                <p className="muted small">{Number(quote?.metalWeightGrams ?? 0).toFixed(2)} grams</p>
              </div>

              <div className="detailCard">
                <span>Center Stone</span>
                <strong>
                  {Number(quote?.centerDiamondCarats ?? 0).toFixed(2)} ct {analysis?.centerShape || "Round"}
                </strong>
                <p className="muted small">{quote?.colorClarity || "E VS1"} ({analysis?.settingType || "Prong"} setting)</p>
              </div>

              <div className="detailCard">
                <span>Side Accent Stones</span>
                <strong>
                  {quote?.sideDiamondQuantity ?? 0} Diamonds ({Number(quote?.sideDiamondCarats ?? 0).toFixed(2)} ctw)
                </strong>
                <p className="muted small">{quote?.sideDiamondQuantity ? "Accent diamonds" : "None"}</p>
              </div>

              <div className="detailCard">
                <span>Azzure Making Price</span>
                <strong style={{ color: "#0F766E" }}>
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(quote?.makingPrice ?? 0))}
                </strong>
                <p className="muted small">Wholesale manufacturing</p>
              </div>

              <div className="detailCard">
                <span>Customer Retail Price</span>
                <strong style={{ color: "#2563EB" }}>
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(quote?.estimatedSellingPrice ?? quote?.estimatedPrice ?? 0))}
                </strong>
                <p className="muted small">End client price</p>
              </div>
            </div>

            {(order.notes || quote?.notes) ? (
              <div className="detailCard" style={{ background: "#F8FAFC" }}>
                <span>Order & Quote Notes / Instructions</span>
                <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#334155", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {quote?.notes ? `[Jeweler Quote Notes]:\n${quote.notes}\n\n` : ""}
                  {order.notes ? `[Order Notes]:\n${order.notes}` : ""}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid twoUp">
        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Tenant & Production Info</h2>
              <p className="muted">Manufacturing integration and CustomKing dispatch tracking.</p>
            </div>
          </div>
          <div className="stack">
            <div className="detailCard">
              <span>Tenant Company</span>
              <strong>{order.company.name}</strong>
              <p className="muted small">Slug: {order.company.slug}</p>
            </div>
            <div className="detailCard">
              <span>Custom King Tracking</span>
              <strong>{order.ckOrderId || "Not dispatched yet"}</strong>
              {order.ckOrderUrl ? (
                <p className="muted small">
                  <a href={order.ckOrderUrl} target="_blank" rel="noreferrer" className="textLink">
                    Open CustomKing Workshop Portal ↗
                  </a>
                </p>
              ) : (
                <p className="muted small">No direct URL provided</p>
              )}
            </div>
            <div className="detailCard">
              <span>Quote Reference</span>
              <strong>
                {quote ? (
                  <Link href={`/admin/quotes/${quote.id}`} className="textLink">
                    {quote.quoteNumber}
                  </Link>
                ) : (
                  "No quote linked"
                )}
              </strong>
              <p className="muted small">Base quote record</p>
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
              <span>Custom King order ID</span>
              <input name="ckOrderId" defaultValue={order.ckOrderId ?? ""} placeholder="CK-100245" />
            </label>
            <label className="field">
              <span>Custom King link</span>
              <input name="ckOrderUrl" defaultValue={order.ckOrderUrl ?? ""} placeholder="https://..." />
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea name="notes" rows={4} defaultValue={order.notes ?? ""} placeholder="Add internal support notes or cancellation reason" />
            </label>
            <div className="heroActions">
              <button className="button primary" type="submit">
                Save order changes
              </button>
            </div>
          </form>

          <div className="detailCard" style={{ marginTop: "1rem" }}>
            <span>Workflow events</span>
            <div className="stack">
              {order.timeline.length === 0 ? (
                <p className="muted small">No order events recorded yet.</p>
              ) : (
                order.timeline.map((event) => (
                  <div key={event.id}>
                    <strong>{event.status}</strong>
                    <p className="muted small">{formatDate(event.createdAt)}</p>
                    {event.note ? <p className="muted small">{event.note}</p> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </article>
      </section>
    </InternalAdminShell>
  );
}

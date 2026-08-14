import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import OrderCancelButton from "@/components/order-cancel-button";
import WorkspaceShell from "@/components/workspace-shell";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { getWorkspaceNav } from "@/lib/workspace-nav";
import { getOrder, getOrderTimeline } from "@/src/services/orders";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function formatRelativeTime(date: Date | null) {
  if (!date) return "Awaiting update";
  return date.toLocaleString();
}

type OrderDetailPageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  const { orderId } = await params;
  const result = await getOrder({
    companyId: context.company.id,
    orderId
  });

  if ("error" in result) {
    notFound();
  }

  const order = result.data;
  const timeline = getOrderTimeline(order);
  const canCancel = !["COMPLETED", "CANCELED", "CANCELLED"].includes(order.status);

  return (
    <WorkspaceShell
      title={`Order ${order.orderNumber}`}
      description="Review the manufacturing specification and follow the order timeline."
      navItems={getWorkspaceNav("/")}
      actions={
        <Link className="button secondary" href="/orders">
          Back to orders
        </Link>
      }
    >
      <section className="grid twoUp">
        <article className="card">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Order spec</p>
              <h2>{order.itemName}</h2>
            </div>
            <StatusBadge status={order.status} />
          </div>
          <div className="detailStack">
            <div className="detailRow">
              <span>From quote</span>
              <strong>{order.quote.quoteNumber}</strong>
            </div>
            <div className="detailRow">
              <span>Metal</span>
              <strong>{order.quote.metalType}</strong>
            </div>
            <div className="detailRow">
              <span>Estimate</span>
              <strong>{formatCurrency(Number(order.quote.estimatedPrice))}</strong>
            </div>
            <div className="detailRow">
              <span>Submitted</span>
              <strong>{formatRelativeTime(order.submittedAt)}</strong>
            </div>
            {order.ckOrderId ? (
              <div className="detailRow">
                <span>Custom King order</span>
                <strong>{order.ckOrderUrl ? <a href={order.ckOrderUrl} target="_blank" rel="noreferrer">{order.ckOrderId}</a> : order.ckOrderId}</strong>
              </div>
            ) : null}
            {order.ckOrderPlacedAt ? (
              <div className="detailRow">
                <span>CK placed</span>
                <strong>{formatRelativeTime(order.ckOrderPlacedAt)}</strong>
              </div>
            ) : null}
          </div>

          {order.notes ? (
            <div className="detailCard detailCard--stacked" style={{ marginTop: "1rem" }}>
              <span>Notes from Azzure</span>
              <p className="muted">{order.notes}</p>
            </div>
          ) : null}

          <div style={{ marginTop: "1rem" }}>
            <Link className="button secondary" href={`/api/quotes/${order.quote.id}/pdf`} target="_blank">
              Download Quote PDF
            </Link>
          </div>

          {canCancel ? (
            <div style={{ marginTop: "1rem" }}>
              <OrderCancelButton orderId={order.id} />
            </div>
          ) : null}
        </article>

        <article className="card">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Status timeline</p>
              <h2>Order progress</h2>
            </div>
          </div>
          <div className="orderTimeline">
            {timeline.map((step) => (
              <div key={step.status} className={`orderTimelineStep${step.completed ? " isComplete" : ""}`}>
                <div className="orderTimelineMarker" />
                <div>
                  <strong>{step.label}</strong>
                  <p className="muted small">{formatRelativeTime(step.timestamp)}</p>
                  {step.note ? <p className="muted small">{step.note}</p> : null}
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </WorkspaceShell>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav } from "@/lib/internal-admin-nav";
import { getAdminSubscriptions } from "@/src/services/admin-tenants";
import { ensureBasePlans } from "@/lib/plan-bootstrap";

export const dynamic = "force-dynamic";

function formatDate(date: Date | null | undefined) {
  return date ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date) : "Not set";
}

export default async function AdminSubscriptionPage() {
  const context = await getInternalAdminContext();
  if (!context) {
    redirect("/signin");
  }

  await ensureBasePlans(prisma);
  const [data, plans] = await Promise.all([
    getAdminSubscriptions(),
    prisma.plan.findMany({ where: { code: { in: ["starter", "professional", "enterprise"] } }, orderBy: { monthlyPriceCents: "asc" } })
  ]);

  return (
    <InternalAdminShell
      title="Subscription management"
      description="Review every customer subscription, adjust plan state, and jump back to billing when needed."
      navItems={getInternalAdminNav("/admin/tenants/subscriptions")}
      adminName={context.user.name || context.user.email}
      actions={
        <>
          <Link className="button secondary" href="/admin/tenants">
            Tenants
          </Link>
          <Link className="button secondary" href="/admin/platform/settings">
            Platform settings
          </Link>
        </>
      }
    >
      <section className="statGrid">
        <article className="statCard statCard--admin">
          <span className="eyebrow">Active</span>
          <strong>{data.totals.active}</strong>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Trialing</span>
          <strong>{data.totals.trialing}</strong>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Past due</span>
          <strong>{data.totals.pastDue}</strong>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Canceled</span>
          <strong>{data.totals.canceled}</strong>
        </article>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Subscription roster</h2>
            <p className="muted">Use the quick editor to change the plan or subscription state in place.</p>
          </div>
        </div>
        <div className="stack">
          {data.rows.map((row) => (
            <form
              key={row.companyId}
              className="planCard"
              action={`/api/admin/billing/${row.companyId}`}
              method="post"
            >
              <input type="hidden" name="redirectTo" value="/admin/tenants/subscriptions" />
              <input type="hidden" name="companyName" value={row.companyName} />
              <input type="hidden" name="companySlug" value={row.companySlug} />
              <input type="hidden" name="quoteSequence" value="0" />
              <input type="hidden" name="logoUrl" value="" />
              <input type="hidden" name="stripeCustomerId" value={row.subscription.stripeCustomerId ?? ""} />
              <input
                type="hidden"
                name="stripeSubscriptionId"
                value={row.subscription.stripeSubscriptionId ?? ""}
              />
              <input type="hidden" name="stripeProductId" value={row.subscription.stripeProductId ?? ""} />
              <input type="hidden" name="stripePriceId" value={row.subscription.stripePriceId ?? ""} />
              <input
                type="hidden"
                name="currentPeriodStart"
                value={row.subscription.currentPeriodStart.toISOString().slice(0, 10)}
              />
              <input
                type="hidden"
                name="currentPeriodEnd"
                value={row.subscription.currentPeriodEnd.toISOString().slice(0, 10)}
              />
              <input type="hidden" name="overagePriceCents" value={row.subscription.overagePriceCents ?? ""} />
              <div style={{ flex: 1, display: "grid", gap: 8 }}>
                <div className="sectionHeader" style={{ marginBottom: 0 }}>
                  <div>
                    <strong>{row.companyName}</strong>
                    <p className="muted small">{row.companySlug}</p>
                  </div>
                  <Link className="textLink" href={`/admin/tenants/${row.companyId}`}>
                    View tenant
                  </Link>
                </div>
                <p className="muted small">
                  {row.quotes} quotes · {row.orders} orders · {row.members} members · usage period{" "}
                  {formatDate(row.usagePeriod?.periodStart)} to {formatDate(row.usagePeriod?.periodEnd)}
                </p>
                <div className="grid twoUp">
                  <label className="field">
                    <span>Plan</span>
                    <select name="planId" defaultValue={row.subscription.planId}>
                      {plans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name} ({plan.code})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Status</span>
                    <select name="subscriptionStatus" defaultValue={row.subscription.status}>
                      <option value="TRIALING">TRIALING</option>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="PAST_DUE">PAST_DUE</option>
                      <option value="CANCELED">CANCELED</option>
                    </select>
                  </label>
                </div>
              </div>
              <button className="button primary" type="submit">
                Save subscription
              </button>
            </form>
          ))}
        </div>
      </section>
    </InternalAdminShell>
  );
}

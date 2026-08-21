import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav } from "@/lib/internal-admin-nav";
import { formatAdminMoney, getAdminTenant } from "@/src/services/admin-tenants";
import { AdminDeleteCompanyButton } from "@/components/admin-delete-company-button";

type TenantPageProps = {
  params: Promise<{
    companyId: string;
  }>;
};

function formatDate(date: Date | null | undefined) {
  return date ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date)) : "Never";
}

export const dynamic = "force-dynamic";

export default async function AdminTenantPage({ params }: TenantPageProps) {
  const context = await getInternalAdminContext();
  if (!context) {
    redirect("/signin");
  }

  const { companyId } = await params;
  let data = null;
  let loadError: string | null = null;
  try {
    data = await getAdminTenant(companyId);
  } catch (err) {
    console.error("[admin/tenants/[companyId]] Failed to load tenant:", err);
    loadError = err instanceof Error ? err.message : "Unknown error while loading this tenant.";
  }

  if (loadError) {
    return (
      <InternalAdminShell
        title="Unable to load tenant"
        description="The tenant record could not be loaded because of a server error, not because it doesn't exist."
        navItems={getInternalAdminNav("/admin/tenants")}
        adminName={context.user.name || context.user.email}
      >
        <section className="card" style={{ borderColor: "#ef4444" }}>
          <h2>Failed to load tenant {companyId}</h2>
          <p className="muted">
            This is a server-side error (e.g. a database schema mismatch or connectivity issue), not a missing
            record. Check the server logs for the full stack trace.
          </p>
          <pre style={{ whiteSpace: "pre-wrap", background: "#0f172a", color: "#fca5a5", padding: "12px 16px", borderRadius: 8, fontSize: 13 }}>
            {loadError}
          </pre>
          <Link className="button secondary" href="/admin/tenants">
            Back to tenants
          </Link>
        </section>
      </InternalAdminShell>
    );
  }

  if (!data || !data.company) {
    notFound();
  }

  const { company } = data;
  const subscription = data.subscription;
  const stats = data.stats || { quotes: 0, orders: 0, members: 0, analyses: 0, activity: 0 };
  const recentQuotes = data.recentQuotes || [];
  const recentOrders = data.recentOrders || [];
  const recentActivity = data.recentActivity || [];
  const pricingProfile = data.pricingProfile || {
    goldSpotPerOz: 4500,
    cadCharge: 20,
    centerSettingPerCarat: 20,
    finalMultiplier: 2
  };

  return (
    <InternalAdminShell
      title={company.name}
      description="Tenant detail with subscription health, pricing profile, activity history, and support actions."
      navItems={getInternalAdminNav("/admin/tenants")}
      adminName={context.user.name || context.user.email}
      actions={
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <Link className="button secondary" href={`/admin/billing/${company.id}`}>
            Edit billing
          </Link>
          <form action={`/api/admin/tenants/${company.id}/impersonate`} method="post">
            <button className="button secondary" type="submit">
              Open company context
            </button>
          </form>
          <AdminDeleteCompanyButton
            companyId={company.id}
            companyName={company.name}
            redirectTo="/admin/tenants"
          />
        </div>
      }
    >
      <section className="statGrid">
        <article className="statCard statCard--admin">
          <span className="eyebrow">Pricing tier</span>
          <strong>{company.pricingTier?.replace("TIER_", "Tier ") ?? "Unassigned"}</strong>
          <p className="muted small">Since {formatDate(company.tierChangedAt ?? company.approvedAt)}</p>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Subscription</span>
          <strong>{subscription?.status?.toLowerCase() ?? "inactive"}</strong>
          <p className="muted small">{subscription?.plan?.name ?? "No plan assigned"}</p>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Quotes</span>
          <strong>{stats.quotes}</strong>
          <p className="muted small">Quote history available for review.</p>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Orders</span>
          <strong>{stats.orders}</strong>
          <p className="muted small">Manufacturing orders linked to this tenant.</p>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Members</span>
          <strong>{stats.members}</strong>
          <p className="muted small">Users assigned to the company.</p>
        </article>
      </section>

      <section className="grid twoUp">
        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Company profile</h2>
              <p className="muted">Identity, trial state, and current billing posture.</p>
            </div>
          </div>
          <div className="stack">
            <div className="detailCard">
              <span>Slug</span>
              <strong>{company.slug}</strong>
              <p className="muted small">Created {formatDate(company.createdAt)}</p>
            </div>
            <div className="detailCard">
              <span>Quote sequence</span>
              <strong>{company.quoteSequence}</strong>
            </div>
            <div className="detailCard">
              <span>Website</span>
              <strong>{company.websiteUrl || "Not set"}</strong>
            </div>
            <div className="detailCard">
              <span>About us</span>
              <strong>{company.aboutUs ? "Configured" : "Not set"}</strong>
            </div>
            <div className="detailCard">
              <span>Custom King verification</span>
              <strong>{company.ckCustomerVerified ? "Verified" : "Not verified"}</strong>
              <p className="muted small">
                {company.ckCustomerVerifiedAt ? `Approved ${formatDate(company.ckCustomerVerifiedAt)}` : "No approval on file"}
              </p>
              {company.ckCustomerNotes ? <p className="muted small">{company.ckCustomerNotes}</p> : null}
            </div>
          </div>
        </article>

        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Subscription snapshot</h2>
              <p className="muted">Support-friendly view of plan, current period, and usage guardrails.</p>
            </div>
          </div>
          <div className="stack">
            <div className="detailCard">
              <span>Plan</span>
              <strong>{subscription?.plan?.code ?? "No plan"}</strong>
              <p className="muted small">{subscription?.plan?.monthlyLimit ?? 0} requests/month</p>
            </div>
            <div className="detailCard">
              <span>Current period</span>
              <strong>{formatDate(subscription?.currentPeriodStart)} - {formatDate(subscription?.currentPeriodEnd)}</strong>
            </div>
            <div className="detailCard">
              <span>Trial usage</span>
              <strong>
                {subscription?.trialQuotesUsed ?? 0} / {subscription?.trialQuoteCap ?? 0}
              </strong>
            </div>
            <div className="detailCard">
              <span>Overage</span>
              <strong>{subscription?.overageEnabled ? "Enabled" : "Disabled"}</strong>
              <p className="muted small">
                {subscription?.overagePriceCents ? formatAdminMoney(subscription.overagePriceCents / 100) : "No overage price"}
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Pricing tier</h2>
            <p className="muted">Changes apply to future quotes only. Existing quote snapshots remain unchanged.</p>
          </div>
        </div>
        <form className="stack" action={`/api/admin/tenants/${company.id}/status`} method="post">
          <input type="hidden" name="accountStatus" value="APPROVED" />
          <input type="hidden" name="next" value={`/admin/tenants/${company.id}`} />
          <label className="field">
            <span>New pricing tier</span>
            <select name="pricingTier" defaultValue={company.pricingTier ?? ""} required>
              <option value="TIER_1" disabled={company.pricingTier === "TIER_1"}>Tier 1 - Premium (divide by 0.6)</option>
              <option value="TIER_2" disabled={company.pricingTier === "TIER_2"}>Tier 2 - Standard (divide by 0.7)</option>
              <option value="TIER_3" disabled={company.pricingTier === "TIER_3"}>Tier 3 - Basic (divide by 0.8)</option>
            </select>
          </label>
          <label className="field">
            <span>Reason (internal, required)</span>
            <textarea name="tierChangeReason" required rows={2} />
          </label>
          <button className="button primary" type="submit">Save tier change</button>
        </form>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Custom King access</h2>
            <p className="muted">Approve this tenant for manufacturing orders or revoke access if needed.</p>
          </div>
        </div>
        <div className="heroActions">
          <form action={`/api/admin/tenants/${company.id}/ck-verification`} method="post">
            <input type="hidden" name="action" value="verify" />
            <label className="field"><span>CK notes (internal)</span><input name="notes" /></label>
            <button className="button primary" type="submit" disabled={company.ckCustomerVerified}>
              Verify customer
            </button>
          </form>
          <form action={`/api/admin/tenants/${company.id}/ck-verification`} method="post">
            <input type="hidden" name="action" value="revoke" />
            <label className="field"><span>Revocation reason (required)</span><input name="notes" required /></label>
            <button className="button secondary" type="submit" disabled={!company.ckCustomerVerified}>
              Revoke verification
            </button>
          </form>
        </div>
      </section>

      <section className="grid twoUp">
        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Members</h2>
              <p className="muted">Who can sign in and work this tenant.</p>
            </div>
          </div>
          <div className="stack">
            {(company.memberships || []).map((membership) => (
              <div className="detailCard" key={membership.id}>
                <span>{membership.role}</span>
                <strong>{membership.user.name || membership.user.email}</strong>
                <p className="muted small">{membership.user.email}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Pricing profile</h2>
              <p className="muted">Current calculator inputs saved for this tenant.</p>
            </div>
          </div>
          <div className="pricingGrid">
            <div className="detailCard">
              <span>Gold / oz</span>
              <strong>{Number(pricingProfile.goldSpotPerOz ?? 4500).toFixed(2)}</strong>
            </div>
            <div className="detailCard">
              <span>CAD charge</span>
              <strong>{Number(pricingProfile.cadCharge ?? 20).toFixed(2)}</strong>
            </div>
            <div className="detailCard">
              <span>Center / ct</span>
              <strong>{Number(pricingProfile.centerSettingPerCarat ?? 20).toFixed(2)}</strong>
            </div>
            <div className="detailCard">
              <span>Final multiplier</span>
              <strong>{Number(pricingProfile.finalMultiplier ?? 2).toFixed(2)}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="grid twoUp">
        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Recent quotes</h2>
              <p className="muted">Latest estimates and approved pricing results.</p>
            </div>
          </div>
          <div className="stack">
            {recentQuotes.length === 0 ? (
              <div className="emptyState">
                <strong>No quotes yet</strong>
              </div>
            ) : (
              recentQuotes.map((quote) => (
                <div className="detailCard" key={quote.id}>
                  <span><Link href={`/admin/quotes/${quote.id}`}>{quote.quoteNumber}</Link></span>
                  <strong>Customer: {formatAdminMoney(quote.estimatedSellingPrice ?? quote.estimatedPrice)}</strong>
                  <p className="muted small">Making: {formatAdminMoney(quote.makingPrice)}</p>
                  <p className="muted small">
                    {quote.pricingTierSnapshot ?? "No tier snapshot"} · divisor {quote.tierDivisorSnapshot?.toString() ?? "n/a"}
                  </p>
                  <p className="muted small">{formatDate(quote.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Recent orders</h2>
              <p className="muted">Order queue entries tied to this tenant.</p>
            </div>
          </div>
          <div className="stack">
            {recentOrders.length === 0 ? (
              <div className="emptyState">
                <strong>No orders yet</strong>
              </div>
            ) : (
              recentOrders.map((order) => (
                <div className="detailCard" key={order.id}>
                  <span>{order.orderNumber}</span>
                  <strong>{order.status}</strong>
                  <p className="muted small">{formatDate(order.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Recent activity</h2>
            <p className="muted">Audit trail for support and internal troubleshooting.</p>
          </div>
        </div>
        <div className="adminFeed">
          {recentActivity.map((entry) => (
            <div className="adminFeedItem" key={entry.id}>
              <div className="adminTone adminTone--info" aria-hidden="true" />
              <div style={{ flex: 1 }}>
                <div className="adminFeedMeta">
                  <strong>{entry.action}</strong>
                  <span className="badge">{entry.targetType ?? "Event"}</span>
                </div>
                <p className="muted small">{formatDate(entry.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card dangerZone">
        <div className="sectionHeader">
          <div>
            <span className="eyebrow" style={{ color: "#ef4444", fontWeight: 700 }}>Danger zone</span>
            <h2>Delete company permanently</h2>
            <p className="muted">
              Removes this company from the application and deletes its subscriptions, memberships, quotes, analyses, orders, showroom sessions, audit records, and orphaned user accounts from the database.
            </p>
          </div>
          <AdminDeleteCompanyButton
            companyId={company.id}
            companyName={company.name}
            redirectTo="/admin/tenants"
          />
        </div>
      </section>
    </InternalAdminShell>
  );
}

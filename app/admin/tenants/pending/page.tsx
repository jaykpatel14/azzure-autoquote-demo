import Link from "next/link";
import { redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav, requireAdminRouteAccess } from "@/lib/internal-admin-nav";
import { getPendingApprovalCompanies } from "@/src/services/admin-tenants";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export default async function PendingApprovalsPage() {
  const context = await getInternalAdminContext();
  if (!context) {
    redirect("/signin");
  }

  requireAdminRouteAccess("/admin/tenants/pending", context.user.adminRole as any);

  const companies = await getPendingApprovalCompanies();

  return (
    <InternalAdminShell
      title="Pending approvals"
      description="Review new companies, assign a pricing tier, and approve or suspend access."
      navItems={getInternalAdminNav("/admin/tenants/pending", context.user.adminRole as any)}
      adminName={context.user.name || context.user.email}
      actions={
        <Link className="button secondary" href="/admin/tenants">
          Back to tenants
        </Link>
      }
    >
      <section className="warningBanner">
        <strong>{companies.length} account{companies.length === 1 ? "" : "s"} waiting for approval</strong>
        <p>Waiting longest first. A tier must be selected before approval.</p>
      </section>
      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Awaiting review</h2>
            <p className="muted">These companies signed up successfully but cannot access the workspace yet.</p>
          </div>
        </div>
        {companies.length === 0 ? (
          <div className="emptyState">
            <strong>No pending approvals</strong>
            <p className="muted">Every company is already approved or suspended.</p>
          </div>
        ) : (
          <div className="stack">
            {companies.map((company) => (
              <div key={company.id} className="detailCard detailCard--stacked">
                <div className="sectionHeader">
                  <div>
                    <span className="eyebrow">{company.slug}</span>
                    <h3>{company.name}</h3>
                    <p className="muted small">Signed up {formatDate(company.createdAt)}</p>
                    <p className="muted small">Website: {company.websiteUrl || "Not provided"}</p>
                  </div>
                  <span className="badge">pending approval</span>
                </div>
                <p className="muted small">
                  Owner: {company.membership?.user.email ?? "Unknown"}{" "}
                  {company.membership?.user.name ? `- ${company.membership.user.name}` : ""}
                </p>
                <form action={`/api/admin/tenants/${company.id}/status`} method="post" className="stack">
                  <input type="hidden" name="next" value="/admin/tenants/pending" />
                  <label className="field">
                    <span>Pricing tier</span>
                    <select name="pricingTier" defaultValue={company.pricingTier ?? ""} required>
                      <option value="" disabled>Select a tier before approval</option>
                      <option value="TIER_1">Tier 1 - Premium</option>
                      <option value="TIER_2">Tier 2 - Standard</option>
                      <option value="TIER_3">Tier 3 - Basic</option>
                    </select>
                  </label>
                  <fieldset className="detailCard">
                    <legend>Custom King verification</legend>
                    <label><input type="radio" name="ckCustomerVerified" value="false" defaultChecked /> Not a CK customer</label>
                    <label><input type="radio" name="ckCustomerVerified" value="true" /> Verified CK customer</label>
                  </fieldset>
                  <label className="field">
                    <span>CK notes (internal)</span>
                    <textarea name="ckCustomerNotes" rows={2} placeholder="CK email, account ID, or reference" />
                  </label>
                  <label className="field">
                    <span>Admin notes (never shown to the jeweler)</span>
                    <textarea name="adminNotes" rows={2} />
                  </label>
                  <label className="field">
                    <span>Decline / suspension reason</span>
                    <textarea
                      name="suspendedReason"
                      rows={2}
                      placeholder="Optional note if you suspend instead of approve."
                    />
                  </label>
                  <div className="buttonRow">
                    <button className="button primary" type="submit" name="accountStatus" value="APPROVED">
                      Approve company with selected tier
                    </button>
                    <button className="button secondary" type="submit" name="accountStatus" value="SUSPENDED" formNoValidate>
                      Decline company
                    </button>
                  </div>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
    </InternalAdminShell>
  );
}

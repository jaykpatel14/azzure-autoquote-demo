import Link from "next/link";
import { redirect } from "next/navigation";
import WorkspaceShell from "@/components/workspace-shell";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { getWorkspaceNav } from "@/lib/workspace-nav";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  return (
    <WorkspaceShell
      title="Company access"
      description="Customer accounts share one permission level across the tenant."
      navItems={getWorkspaceNav("/team")}
      actions={
        <Link className="button secondary" href="/settings">
          Back to settings
        </Link>
      }
    >
      <section className="statGrid">
        <article className="statCard">
          <span className="eyebrow">Company</span>
          <strong>{context.company.name}</strong>
          <p className="muted small">{context.memberships.length} customer account(s) in this tenant</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Access model</span>
          <strong>Customer</strong>
          <p className="muted small">All company users have the same customer permissions.</p>
        </article>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Access summary</h2>
            <p className="muted">
              Team role tiers were removed. Every company user now has customer access, while Azzure admins
              are handled separately through the internal admin allowlist.
            </p>
          </div>
        </div>
        <div className="emptyState">
          <strong>No per-user roles</strong>
          <p className="muted">
            The customer workspace no longer distinguishes between owner, admin, estimator, or viewer.
          </p>
        </div>
      </section>
    </WorkspaceShell>
  );
}

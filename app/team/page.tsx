import Link from "next/link";
import { redirect } from "next/navigation";
import WorkspaceShell from "@/components/workspace-shell";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { hasMinimumRole } from "@/lib/tenant";
import { getWorkspaceNav } from "@/lib/workspace-nav";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  if (!hasMinimumRole(context.membership.role, "ADMIN")) {
    redirect("/");
  }

  return (
    <WorkspaceShell
      title="Team management"
      description="Review who has access to this company and what they can do."
      navItems={getWorkspaceNav("/team")}
      actions={
        <Link className="button secondary" href="/settings">
          Back to settings
        </Link>
      }
    >
      <section className="statGrid">
        <article className="statCard">
          <span className="eyebrow">Members</span>
          <strong>{context.memberships.length}</strong>
          <p className="muted small">All memberships are scoped to the active company.</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Your role</span>
          <strong>{context.membership.role}</strong>
          <p className="muted small">Role permissions are enforced server-side on every route.</p>
        </article>
      </section>

      <section className="grid twoUp">
        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Current team</h2>
              <p className="muted">Roles and company access remain tenant-isolated.</p>
            </div>
          </div>
          <div className="tableShell">
            <table className="dataTable">
              <thead>
                <tr>
                  <th scope="col">Member</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {context.memberships.map((membership) => (
                  <tr key={membership.id}>
                    <td>
                      <strong>{membership.company.name}</strong>
                      <p className="muted small">{membership.company.slug}</p>
                    </td>
                    <td>{membership.role}</td>
                    <td>
                      <span className="badge">{membership.companyId === context.company.id ? "Active" : "Shared"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Role guide</h2>
              <p className="muted">Use the least-privileged role that still supports the task.</p>
            </div>
          </div>
          <div className="stack">
            <div className="detailCard">
              <span>OWNER</span>
              <strong>Full control</strong>
              <p className="muted small">Billing, team, pricing, and security operations.</p>
            </div>
            <div className="detailCard">
              <span>ADMIN</span>
              <strong>Workspace admin</strong>
              <p className="muted small">Manage billing, support, and company settings.</p>
            </div>
            <div className="detailCard">
              <span>ESTIMATOR</span>
              <strong>Quote creation</strong>
              <p className="muted small">Upload images, edit estimates, and save quotes.</p>
            </div>
            <div className="detailCard">
              <span>VIEWER</span>
              <strong>Read only</strong>
              <p className="muted small">Review quotes and dashboards without editing.</p>
            </div>
          </div>
        </article>
      </section>
    </WorkspaceShell>
  );
}

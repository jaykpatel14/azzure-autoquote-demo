import Link from "next/link";
import { redirect } from "next/navigation";
import SettingsTabs from "@/components/settings-tabs";
import TeamMemberRow from "@/components/team-member-row";
import WorkspaceShell from "@/components/workspace-shell";
import { getAuthenticatedCompanyContext, canManageTeam } from "@/lib/company";
import { getWorkspaceNav } from "@/lib/workspace-nav";
import { getSettingsTeamData } from "@/src/services/settings";
import { getFeaturesForPlan, resolvePlanId } from "@/src/stripe/plans";

export default async function TeamSettingsPage() {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  const company = await getSettingsTeamData(context.company.id);
  if (!company) {
    redirect("/settings");
  }

  const hasManageAccess = canManageTeam(context.membership?.role ?? "CUSTOMER");
  const subscription = context.company.subscription;
  const maxSeats = subscription ? getFeaturesForPlan(resolvePlanId(subscription.plan, subscription.status)).maxSeats : 1;
  const atSeatLimit = company.memberships.length >= maxSeats;

  return (
    <WorkspaceShell
      title="Team"
      description="Manage who can access this company and what they can do."
      navItems={getWorkspaceNav("/settings")}
      actions={
        <Link className="button secondary" href="/settings">
          Back to billing
        </Link>
      }
    >
      <SettingsTabs activeHref="/settings/team" />

      <section className="grid twoUp">
        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Team members</h2>
              <p className="muted">
                {Number.isFinite(maxSeats) ? `Your plan supports up to ${maxSeats} seats.` : "Your plan supports unlimited seats."}
              </p>
            </div>
          </div>
          <div className="stack">
            {company.memberships.map((membership) => (
              <TeamMemberRow
                key={membership.id}
                membershipId={membership.id}
                name={membership.user.name || membership.user.email}
                email={membership.user.email}
                role={membership.role}
                removable={hasManageAccess && membership.role !== "OWNER"}
              />
            ))}
          </div>
        </article>

        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Invite member</h2>
              <p className="muted">Add a teammate by email. They can sign in with their existing account or set up a new one.</p>
            </div>
          </div>
          {atSeatLimit ? (
            <div className="emptyState">
              <strong>Your plan seat limit has been reached. Upgrade to add team members.</strong>
              <p className="muted">Professional unlocks 5 seats, and Enterprise removes the seat cap entirely.</p>
              <Link className="button primary" href="/settings/billing?upgrade=1">
                Review plans
              </Link>
            </div>
          ) : (
            <form className="stack" action="/api/settings/team" method="post">
              <label className="field">
                <span>Name</span>
                <input name="name" placeholder="New team member" />
              </label>
              <label className="field">
                <span>Email</span>
                <input name="email" type="email" placeholder="user@shop.com" required />
              </label>
              <label className="field">
                <span>Password</span>
                <input name="password" type="password" minLength={8} placeholder="Required for new users" />
              </label>
              <p className="muted small">
                We email the teammate a sign-in link once they are added to the company.
              </p>
              <button className="button primary" type="submit" style={{ width: "fit-content" }}>
                Invite member
              </button>
            </form>
          )}
        </article>
      </section>
    </WorkspaceShell>
  );
}

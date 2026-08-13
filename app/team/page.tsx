import Link from "next/link";
import { redirect } from "next/navigation";
import TrialBanner from "@/components/trial-banner";
import TrialSidebarStatus from "@/components/trial-sidebar-status";
import WorkspaceShell from "@/components/workspace-shell";
import { getTrialDaysRemaining, getTrialQuotesRemaining } from "@/lib/billing";
import { canManageTeam, getAuthenticatedCompanyContext } from "@/lib/company";
import { getWorkspaceNav } from "@/lib/workspace-nav";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  if (context.company.subscription && !context.company.subscription.onboardingComplete) {
    redirect("/onboarding");
  }

  const trialDaysRemaining = getTrialDaysRemaining(context.company.subscription);
  const trialQuotesRemaining = getTrialQuotesRemaining(context.company.subscription);

  return (
    <WorkspaceShell
      title="Company access"
      description="Company access is role-based, with the active membership determining what the workspace can do."
      navItems={getWorkspaceNav("/team")}
      banner={
        context.company.subscription?.status === "TRIALING" &&
        trialDaysRemaining !== null &&
        trialQuotesRemaining !== null ? (
          <TrialBanner
            companyId={context.company.id}
            daysRemaining={trialDaysRemaining}
            quoteCap={context.company.subscription.trialQuoteCap}
            quotesRemaining={trialQuotesRemaining}
          />
        ) : null
      }
      sidebarExtra={
        context.company.subscription?.status === "TRIALING" &&
        trialDaysRemaining !== null &&
        trialQuotesRemaining !== null ? (
          <TrialSidebarStatus
            daysRemaining={trialDaysRemaining}
            quoteCap={context.company.subscription.trialQuoteCap}
            quotesRemaining={trialQuotesRemaining}
            urgent={trialDaysRemaining <= 3}
          />
        ) : null
      }
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
          <strong>{context.membership?.role ?? "CUSTOMER"}</strong>
          <p className="muted small">Your active membership controls what you can access in this tenant.</p>
        </article>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Access summary</h2>
            <p className="muted">
              Role tiers are now modeled in the database and onboarding creates the company owner membership
              as <code>OWNER</code>.
            </p>
          </div>
        </div>
        <div className="emptyState">
          <strong>{canManageTeam(context.membership?.role ?? "CUSTOMER") ? "Team access enabled" : "View-only access"}</strong>
          <p className="muted">
            {canManageTeam(context.membership?.role ?? "CUSTOMER")
              ? "This membership can manage company access and role-based workspace actions."
              : "This membership can review company access but cannot manage team settings."}
          </p>
        </div>
      </section>
    </WorkspaceShell>
  );
}

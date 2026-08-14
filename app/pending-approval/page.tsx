import Link from "next/link";
import { redirect } from "next/navigation";
import AccountStatusPoller from "@/components/account-status-poller";
import SignOutButton from "@/components/sign-out-button";
import WorkspaceShell from "@/components/workspace-shell";
import { getAuthenticatedCompanyContext, isCompanyApproved } from "@/lib/company";
import { getWorkspaceNav } from "@/lib/workspace-nav";

export default async function PendingApprovalPage() {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  if (isCompanyApproved(context.company)) {
    redirect("/");
  }

  return (
    <WorkspaceShell
      title="Waiting for approval"
      description="Your company profile is on hold until the Azzure team approves access."
      navItems={getWorkspaceNav("/pending-approval")}
      actions={<SignOutButton />}
    >
      <section className="card accentCard">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Account status</p>
            <h2>{context.company.name}</h2>
            <p className="muted">
              We received your signup successfully. The workspace will unlock after a manual review.
            </p>
          </div>
        </div>
        <div className="stack">
          <div className="detailRow">
            <span>Status</span>
            <strong>{context.company.accountStatus.toLowerCase().replaceAll("_", " ")}</strong>
          </div>
          <div className="detailRow">
            <span>Pricing tier</span>
            <strong>{context.company.pricingTier ?? "Not assigned yet"}</strong>
          </div>
          <div className="detailRow">
            <span>Next step</span>
            <strong>We&apos;ll email you as soon as the account is approved.</strong>
          </div>
          <AccountStatusPoller />
          <div className="buttonRow">
            <a className="button primary" href="mailto:support@azzuresolutions.com">
              Contact support
            </a>
            <Link className="button secondary" href="/signin">
              Back to sign in
            </Link>
          </div>
        </div>
      </section>
    </WorkspaceShell>
  );
}

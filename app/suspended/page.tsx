import Link from "next/link";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/sign-out-button";
import WorkspaceShell from "@/components/workspace-shell";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { getWorkspaceNav } from "@/lib/workspace-nav";

export default async function SuspendedPage() {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  return (
    <WorkspaceShell
      title="Account suspended"
      description="Your company access is currently paused."
      navItems={getWorkspaceNav("/suspended")}
      actions={<SignOutButton />}
    >
      <section className="card accentCard">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Access paused</p>
            <h2>{context.company.name}</h2>
            <p className="muted">
              This account has been suspended by the Azzure team. Please contact support to restore access.
            </p>
          </div>
        </div>
        <div className="stack">
          <div className="detailRow">
            <span>Status</span>
            <strong>{context.company.accountStatus.toLowerCase().replaceAll("_", " ")}</strong>
          </div>
          <div className="detailRow">
            <span>Reason</span>
            <strong>{context.company.suspendedReason ?? "Not provided"}</strong>
          </div>
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

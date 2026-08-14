import { redirect } from "next/navigation";
import SignOutButton from "@/components/sign-out-button";
import WorkspaceShell from "@/components/workspace-shell";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { getWorkspaceNav } from "@/lib/workspace-nav";

export default async function ConfigurationPage() {
  const context = await getAuthenticatedCompanyContext();
  if (!context) redirect("/signin");
  if (context.company.accountStatus !== "APPROVED") redirect("/pending-approval");
  if (context.company.pricingTier) redirect("/");
  return <WorkspaceShell title="Pricing setup in progress" description="Your account is approved, but its pricing configuration still needs to be completed by Azzure." navItems={getWorkspaceNav("/configuration")} actions={<SignOutButton />}>
    <section className="card accentCard"><p className="eyebrow">Configuration required</p><h2>Your quotes are temporarily unavailable</h2><p className="muted">We have paused quote access to protect pricing accuracy. Contact Azzure and we will assign the correct pricing tier to your company.</p><a className="button primary" href="mailto:support@azzuresolutions.com">Contact Azzure support</a></section>
  </WorkspaceShell>;
}

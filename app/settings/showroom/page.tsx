import { redirect } from "next/navigation";
import WorkspaceShell from "@/components/workspace-shell";
import SettingsTabs from "@/components/settings-tabs";
import ShowroomSettingsActions from "@/components/showroom-settings-actions";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { getWorkspaceNav } from "@/lib/workspace-nav";
import { getFeaturesForPlan, resolvePlanId } from "@/src/stripe/plans";
import { prisma } from "@/lib/prisma";

async function fetchShowroomStats(companyId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  return Promise.all([
    prisma.showroomSession.findUnique({ where: { companyId } }),
    prisma.showroomQuote.count({ where: { companyId, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.showroomQuote.count({ where: { companyId, claimedAt: { not: null }, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.showroomQuote.count({ where: { companyId, status: "CONVERTED", createdAt: { gte: thirtyDaysAgo } } })
  ]);
}

export default async function ShowroomSettingsPage() {
  const context = await getAuthenticatedCompanyContext();
  if (!context) redirect("/signin");

  const subscription = context.company.subscription;
  const allowed = Boolean(subscription && getFeaturesForPlan(resolvePlanId(subscription.plan, subscription.status)).canUseShowroomMode);
  if (!allowed) redirect("/settings/billing?upgrade=ultra");

  const [session, generated, claimed, converted] = await fetchShowroomStats(context.company.id);

  return (
    <WorkspaceShell
      title="Showroom Mode"
      description="Turn a display into a customer-facing quote kiosk with your branding."
      navItems={getWorkspaceNav("/settings")}
    >
      <SettingsTabs activeHref="/settings/showroom" showShowroom />
      <section className="card stack">
        <h2>Customer quote kiosk</h2>
        <p className="muted">
          Customers can upload inspiration, receive an estimate, and save a short code for your team. No personal information is collected.
        </p>
        <ShowroomSettingsActions initialToken={session?.isActive ? session.token : null} />
        <hr />
        <h3>Last 30 days</h3>
        <p>
          <strong>{generated}</strong> generated · <strong>{claimed}</strong> claimed · <strong>{converted}</strong> converted
        </p>
      </section>
    </WorkspaceShell>
  );
}

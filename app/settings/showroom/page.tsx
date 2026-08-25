import Link from "next/link";
import { redirect } from "next/navigation";
import WorkspaceShell from "@/components/workspace-shell";
import SettingsTabs from "@/components/settings-tabs";
import ShowroomSettingsActions from "@/components/showroom-settings-actions";
import ShowroomCustomizer from "@/components/showroom-customizer";
import ShowroomDevicesTab from "@/components/showroom-devices-tab";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { getWorkspaceNav } from "@/lib/workspace-nav";
import { getFeaturesForPlan, resolvePlanId } from "@/src/stripe/plans";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function fetchShowroomStats(companyId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  return Promise.all([
    prisma.showroomSession.findUnique({ where: { companyId } }),
    prisma.showroomQuote.count({ where: { companyId, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.showroomQuote.count({ where: { companyId, claimedAt: { not: null }, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.showroomQuote.count({ where: { companyId, status: "CONVERTED", createdAt: { gte: thirtyDaysAgo } } })
  ]);
}

export default async function ShowroomSettingsPage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const context = await getAuthenticatedCompanyContext();
  if (!context) redirect("/signin");

  const subscription = context.company.subscription;
  const allowed = Boolean(subscription && getFeaturesForPlan(resolvePlanId(subscription.plan, subscription.status)).canUseShowroomMode);
  if (!allowed) redirect("/settings/billing?upgrade=enterprise");

  const activeTab = (await searchParams).tab === "devices" ? "devices" : "general";
  const [session, generated, claimed, converted] = await fetchShowroomStats(context.company.id);

  return (
    <WorkspaceShell
      title="Showroom Mode & Customization"
      description="Turn a display or tablet into a luxury customer-facing quote kiosk with your custom branding, devices, and colors."
      navItems={getWorkspaceNav("/settings")}
    >
      <SettingsTabs activeHref="/settings/showroom" showShowroom />

      {/* Sub-tabs for Showroom Settings */}
      <div style={{ display: "flex", gap: 8, marginBottom: "var(--space-4)" }}>
        <Link
          href="/settings/showroom"
          className={`button ${activeTab === "general" ? "primary" : "secondary"}`}
          style={{ padding: "8px 18px", fontSize: "0.9rem" }}
        >
          Appearance &amp; Theme
        </Link>
        <Link
          href="/settings/showroom?tab=devices"
          className={`button ${activeTab === "devices" ? "primary" : "secondary"}`}
          style={{ padding: "8px 18px", fontSize: "0.9rem" }}
        >
          Registered Devices
        </Link>
      </div>

      {activeTab === "devices" ? (
        <ShowroomDevicesTab showroomToken={session?.isActive ? session.token : null} />
      ) : (
        <div className="stack" style={{ gap: "var(--space-6)" }}>
          {/* Kiosk Activation & Access Token */}
          <section className="card stack">
            <div className="sectionHeader">
              <div>
                <span className="eyebrow">Kiosk Activation</span>
                <h2>Customer Quote Kiosk</h2>
                <p className="muted">
                  Walk-in clients can upload inspiration photos, adjust parameters, receive an estimate, and save a consultation claim code for your team.
                </p>
              </div>
            </div>
            <ShowroomSettingsActions initialToken={session?.isActive ? session.token : null} />
            <hr />
            <h3>Last 30 days Performance</h3>
            <p>
              <strong>{generated}</strong> generated · <strong>{claimed}</strong> claimed · <strong>{converted}</strong> converted
            </p>
          </section>

          {/* Luxury Showroom Theme & Color Customizer */}
          <ShowroomCustomizer
            initialPrimaryColor={context.company.primaryColor}
            initialAboutUs={context.company.aboutUs}
            companyName={context.company.name}
            logoUrl={context.company.logoUrl}
            initialBackgroundColor={context.company.showroomBackgroundColor}
            initialOverlayColor={context.company.showroomOverlayColor}
            initialOverlayOpacity={context.company.showroomOverlayOpacity}
            initialTextColor={context.company.showroomTextColor}
            initialBackgroundFit={context.company.showroomBackgroundFit}
            initialBackgroundPosition={context.company.showroomBackgroundPosition}
            initialPanelOpacity={context.company.showroomPanelOpacity}
            backgroundMediaUrl={session?.isActive && context.company.showroomBackgroundMediaKey ? `/api/showroom/background?token=${encodeURIComponent(session.token)}` : null}
            backgroundMediaType={context.company.showroomBackgroundMediaType}
          />
        </div>
      )}
    </WorkspaceShell>
  );
}

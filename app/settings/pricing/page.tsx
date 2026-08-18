import Link from "next/link";
import { redirect } from "next/navigation";
import SettingsTabs from "@/components/settings-tabs";
import WorkspaceShell from "@/components/workspace-shell";
import { getAuthenticatedCompanyContext, canManageBilling } from "@/lib/company";
import { getWorkspaceNav } from "@/lib/workspace-nav";
import { prisma } from "@/lib/prisma";

export default async function PricingSettingsPage() {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  const company = await prisma.company.findUnique({
    where: { id: context.company.id },
    select: {
      id: true,
      name: true,
      customerMarginPct: true,
      pricingTier: true
    }
  });

  if (!company) {
    redirect("/settings");
  }

  const canEdit = canManageBilling(context.membership?.role ?? "CUSTOMER");

  return (
    <WorkspaceShell
      title="Pricing & margin settings"
      description="Configure your customer margin percentage added to quote calculations."
      navItems={getWorkspaceNav("/settings")}
      actions={
        <Link className="button secondary" href="/settings">
          Back to settings
        </Link>
      }
    >
      <SettingsTabs activeHref="/settings/pricing" />

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Your margin</h2>
            <p className="muted">
              Add your desired margin percentage to every quote. This is applied to the making subtotal before the end customer price is calculated.
            </p>
          </div>
        </div>

        <form className="stack" action="/api/settings/pricing" method="post">
          <label className="field">
            <span>Customer margin (%)</span>
            <div className="inputUnitRow">
              <input
                type="number"
                name="customerMarginPct"
                min={0}
                max={200}
                step={0.1}
                defaultValue={company.customerMarginPct ?? 0}
                placeholder="0"
                disabled={!canEdit}
                className="shortInput"
              />
              <span className="unitBadge">%</span>
            </div>
            <p className="muted small">
              Allowed range: 0% to 200%. New quotes will snapshot this percentage at creation time. Existing quotes are not affected.
            </p>
          </label>

          {canEdit ? (
            <button className="button primary fitContent" type="submit">
              Save margin settings
            </button>
          ) : (
            <p className="muted small">Only company owners and administrators can change pricing margin settings.</p>
          )}
        </form>
      </section>
    </WorkspaceShell>
  );
}

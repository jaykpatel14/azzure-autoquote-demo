import Link from "next/link";
import { redirect } from "next/navigation";
import SettingsTabs from "@/components/settings-tabs";
import WorkspaceShell from "@/components/workspace-shell";
import { getAuthenticatedCompanyContext, canManageBilling } from "@/lib/company";
import { getWorkspaceNav } from "@/lib/workspace-nav";
import { prisma } from "@/lib/prisma";
import { resolveMetalPricing, toPricingProfileInput } from "@/lib/metal-pricing";

export const dynamic = "force-dynamic";

function formatUsd(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

export default async function PricingSettingsPage() {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  const [company, livePricing] = await Promise.all([
    prisma.company.findUnique({
      where: { id: context.company.id },
      select: {
        id: true,
        name: true,
        customerMarginPct: true,
        pricingTier: true,
        pricingProfile: true
      }
    }),
    resolveMetalPricing()
  ]);

  if (!company) {
    redirect("/settings");
  }

  const canEdit = canManageBilling(context.membership?.role ?? "CUSTOMER");
  const profile = livePricing.pricingProfile;

  const goldSpot = profile.goldSpotPerOz ?? 4500;
  const platSpot = profile.platinumSpotPerOz ?? 985.2;
  const silverSpot = profile.silverSpotPerOz ?? 31.4;

  // Pure metal rate per gram (1 troy oz = 31.1034768 grams)
  const TROY_OZ_TO_GRAMS = 31.1034768;
  const goldPerGram24K = goldSpot / TROY_OZ_TO_GRAMS;
  const goldPerGram14K = goldPerGram24K * (14 / 24);
  const goldPerGram18K = goldPerGram24K * (18 / 24);
  const platPerGram950 = (platSpot / TROY_OZ_TO_GRAMS) * 0.95;
  const silverPerGram925 = (silverSpot / TROY_OZ_TO_GRAMS) * 0.925;

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

      {/* Live Market Feeds */}
      <section className="card">
        <div className="sectionHeader">
          <div>
            <span className="eyebrow">Live Market Data</span>
            <h2>Precious Metal Spot Feeds</h2>
            <p className="muted">
              Live market precious metal spot rates factored into quote making calculations.
            </p>
          </div>
          <div className="consultationPill">
            <span className="consultationDot" aria-hidden="true" />
            <span>{livePricing.source === "metals.dev" ? "Live Market Feed" : "Active Live Engine"}</span>
          </div>
        </div>

        <div className="statGrid">
          <article className="statCard">
            <span className="eyebrow">XAU · Fine Gold (24K)</span>
            <strong>{formatUsd(goldSpot)}<span className="small muted"> / oz</span></strong>
            <p className="muted small">14K: ~{formatUsd(goldPerGram14K)}/g | 18K: ~{formatUsd(goldPerGram18K)}/g</p>
          </article>

          <article className="statCard">
            <span className="eyebrow">XPT · Pure Platinum</span>
            <strong>{formatUsd(platSpot)}<span className="small muted"> / oz</span></strong>
            <p className="muted small">950 Plat: ~{formatUsd(platPerGram950)}/g</p>
          </article>

          <article className="statCard">
            <span className="eyebrow">XAG · Sterling Silver</span>
            <strong>{formatUsd(silverSpot)}<span className="small muted"> / oz</span></strong>
            <p className="muted small">925 Silver: ~{formatUsd(silverPerGram925)}/g</p>
          </article>
        </div>
      </section>

      {/* Store Margin & Markups */}
      <section className="card">
        <div className="sectionHeader">
          <div>
            <span className="eyebrow">Retail Pricing Policy</span>
            <h2>Store Margin &amp; Markup</h2>
            <p className="muted">
              Configure your default profit margin markup. This percentage is calculated onto precious metal casting + gemstone settings before retail quote presentation.
            </p>
          </div>
        </div>

        <form className="stack" action="/api/settings/pricing" method="post">
          <label className="field">
            <span>Customer Retail Margin Markup (%)</span>
            <div className="inputUnitRow" style={{ maxWidth: "320px" }}>
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
                style={{ fontSize: "1.25rem", fontWeight: "700" }}
              />
              <span className="unitBadge" style={{ fontWeight: "700" }}>%</span>
            </div>
            <p className="muted small">
              Allowed range: 0% to 200%. Snapshot at the time of each estimate. Existing historic quotes remain unaffected.
            </p>
          </label>

          {canEdit ? (
            <button className="button primary button--lg fitContent" type="submit" style={{ marginTop: "var(--space-2)" }}>
              Save Margin Configuration
            </button>
          ) : (
            <p className="muted small">Only company owners and administrators can change pricing margin settings.</p>
          )}
        </form>
      </section>
    </WorkspaceShell>
  );
}

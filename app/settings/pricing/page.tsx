import Link from "next/link";
import { redirect } from "next/navigation";
import SettingsTabs from "@/components/settings-tabs";
import WorkspaceShell from "@/components/workspace-shell";
import { getAuthenticatedCompanyContext, canManageBilling } from "@/lib/company";
import { getWorkspaceNav } from "@/lib/workspace-nav";
import { prisma } from "@/lib/prisma";
import { resolveMetalPricing } from "@/lib/metal-pricing";
import { getFeaturesForPlan, resolvePlanId } from "@/src/stripe/plans";
import PricingMarginSimulator from "@/components/pricing-margin-simulator";

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
        pricingProfile: true,
        subscription: {
          include: { plan: true }
        }
      }
    }),
    resolveMetalPricing()
  ]);

  if (!company) {
    redirect("/settings");
  }

  const subscription = company.subscription;
  const planId = subscription ? resolvePlanId(subscription.plan, subscription.status) : "plan_starter";
  const features = getFeaturesForPlan(planId);
  const canUseCustomPricing = features.canUseCustomPricingProfile;

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

      <div className="stack" style={{ gap: "var(--space-6)" }}>
        {!canUseCustomPricing && (
          <div className="banner" style={{ background: "rgba(201, 168, 76, 0.08)", border: "1px solid rgba(201, 168, 76, 0.3)", borderRadius: 12, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
            <div>
              <strong style={{ color: "#dfc674", display: "block", marginBottom: 4 }}>Standard Live Spot Engine (Starter Plan)</strong>
              <p className="muted small" style={{ margin: 0 }}>
                Custom pricing profiles, granular formula controls, and custom margin configurations are unlocked on Professional and Enterprise plans.
              </p>
            </div>
            <Link href="/settings/billing?upgrade=professional" className="button primary" style={{ whiteSpace: "nowrap" }}>
              Upgrade Plan
            </Link>
          </div>
        )}

        {/* Live Market Feeds */}
        <section className="card">
          <div className="sectionHeader">
            <div>
              <span className="eyebrow">Live Market Data</span>
              <h2>Precious Metal Spot Feeds</h2>
              <p className="muted">
                Live market precious metal spot rates factored into quote making calculations. Sourced in real time.
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

        {/* Live Margin Configuration & Sample Quote Simulator */}
        <PricingMarginSimulator
          initialMarginPct={Math.max(50, company.customerMarginPct ?? 50)}
          goldSpotPerOz={goldSpot}
          canEdit={canEdit && canUseCustomPricing}
        />
      </div>
    </WorkspaceShell>
  );
}

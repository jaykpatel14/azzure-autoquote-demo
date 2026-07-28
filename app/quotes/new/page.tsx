import { redirect } from "next/navigation";
import QuoteCalculator from "@/components/QuoteCalculator";
import WorkspaceShell from "@/components/workspace-shell";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { normalizePricingProfile, resolveMetalPricing } from "@/lib/metal-pricing";
import { hasMinimumRole } from "@/lib/tenant";
import { getWorkspaceNav } from "@/lib/workspace-nav";

export default async function NewQuotePage() {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  const canEdit = hasMinimumRole(context.membership.role, "ESTIMATOR");
  const basePricingProfile = context.company.pricingProfile
    ? normalizePricingProfile({
        goldSpotPerOz: Number(context.company.pricingProfile.goldSpotPerOz),
        platinumSpotPerOz: Number(context.company.pricingProfile.platinumSpotPerOz),
        silverSpotPerOz: Number(context.company.pricingProfile.silverSpotPerOz),
        cadCharge: Number(context.company.pricingProfile.cadCharge),
        centerSettingPerCarat: Number(context.company.pricingProfile.centerSettingPerCarat),
        sideSettingPerStone: Number(context.company.pricingProfile.sideSettingPerStone),
        sellingMarginDivisor: Number(context.company.pricingProfile.sellingMarginDivisor),
        finalMultiplier: Number(context.company.pricingProfile.finalMultiplier)
      })
    : undefined;
  const livePricing = await resolveMetalPricing(basePricingProfile);

  return (
    <WorkspaceShell
      title="New estimate"
      description="Build a quote in a dedicated workspace, with live metal prices and a full AI review flow."
      navItems={getWorkspaceNav("/quotes/new", context.membership.role)}
    >
      <QuoteCalculator
        canEdit={canEdit}
        pricingProfile={livePricing.pricingProfile}
        pricingSourceLabel={
          livePricing.source === "metals.dev"
            ? "Live metal spot prices are applied to this preview."
            : "Using stored pricing values because live metal pricing is unavailable."
        }
        pricingNote={livePricing.message}
      />
    </WorkspaceShell>
  );
}

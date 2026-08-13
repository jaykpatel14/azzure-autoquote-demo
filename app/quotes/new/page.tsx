import { redirect } from "next/navigation";
import QuoteCalculator from "@/components/QuoteCalculator";
import TrialBanner from "@/components/trial-banner";
import TrialSidebarStatus from "@/components/trial-sidebar-status";
import WorkspaceShell from "@/components/workspace-shell";
import { getTrialDaysRemaining, getTrialQuotesRemaining } from "@/lib/billing";
import { getAuthenticatedCompanyContext, canCreateQuotes } from "@/lib/company";
import { normalizePricingProfile, resolveMetalPricing } from "@/lib/metal-pricing";
import { getWorkspaceNav } from "@/lib/workspace-nav";

export default async function NewQuotePage() {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  if (context.company.subscription && !context.company.subscription.onboardingComplete) {
    redirect("/onboarding");
  }

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
  const canEdit = canCreateQuotes(context.membership?.role ?? "CUSTOMER");
  const trialDaysRemaining = getTrialDaysRemaining(context.company.subscription);
  const trialQuotesRemaining = getTrialQuotesRemaining(context.company.subscription);

  return (
    <WorkspaceShell
      title="New estimate"
      description="Build a quote in a dedicated workspace, with live metal prices and a full AI review flow."
      navItems={getWorkspaceNav("/quotes/new")}
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

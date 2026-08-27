import { redirect } from "next/navigation";
import QuoteCalculator from "@/components/QuoteCalculator";
import TrialBanner from "@/components/trial-banner";
import TrialSidebarStatus from "@/components/trial-sidebar-status";
import WorkspaceShell from "@/components/workspace-shell";
import { getTrialDaysRemaining, getTrialQuotesRemaining } from "@/lib/billing";
import { getAuthenticatedCompanyContext, canCreateQuotes } from "@/lib/company";
import { normalizePricingProfile, resolveMetalPricing } from "@/lib/metal-pricing";
import { getWorkspaceNav } from "@/lib/workspace-nav";
import { getQuote } from "@/src/services/quotes";
import { getSettingValue } from "@/lib/app-settings";
import { getFeaturesForPlan, resolvePlanId } from "@/src/stripe/plans";

type NewQuotePageProps = {
  searchParams?: Promise<{
    sourceQuoteId?: string;
  }>;
};

export default async function NewQuotePage({ searchParams }: NewQuotePageProps) {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  if (context.company.subscription && !context.company.subscription.onboardingComplete) {
    redirect("/onboarding");
  }

  const params = searchParams ? await searchParams : undefined;
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
  const subscription = context.company.subscription;
  const planFeatures = subscription
    ? getFeaturesForPlan(resolvePlanId(subscription.plan, subscription.status))
    : null;
  const trialDaysRemaining = getTrialDaysRemaining(context.company.subscription);
  const trialQuotesRemaining = getTrialQuotesRemaining(context.company.subscription);
  const sourceQuoteId = params?.sourceQuoteId?.trim();
  const sourceQuote = sourceQuoteId
    ? await getQuote({
        quoteId: sourceQuoteId,
        companyId: context.company.id
      }).then((result) => ("data" in result ? result.data : null))
    : null;

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
        companyName={context.company.name}
        companyLogoUrl={context.company.logoUrl}
        pricingTier={context.company.pricingTier ?? "TIER_2"}
        customerMarginPct={context.company.customerMarginPct ?? 0}
        cadCost={(await getSettingValue("cad_cost_per_quote")) ?? 0}
        pricingProfile={livePricing.pricingProfile}
        pricingSourceLabel={
          livePricing.source !== "configured-default"
            ? "Live metal spot prices are applied to this preview."
            : "Using stored pricing values because live metal pricing is unavailable."
        }
        pricingNote={livePricing.message}
        canShareQuoteLink={Boolean(planFeatures?.canShareQuoteLink)}
        canPlaceManufacturingOrder={Boolean(planFeatures?.canPlaceManufacturingOrder)}
        canDownloadPdf={Boolean(planFeatures?.canDownloadPDF)}
        initialQuote={
          sourceQuote
            ? {
                quoteId: sourceQuote.id,
                quoteNumber: sourceQuote.quoteNumber,
                customerName: sourceQuote.customerName,
                metalType: sourceQuote.metalType as "10K" | "14K" | "18K" | "Platinum" | "Silver",
                metalWeightGrams: Number(sourceQuote.metalWeightGrams),
                centerDiamondCarats: Number(sourceQuote.centerDiamondCarats),
                sideDiamondCarats: Number(sourceQuote.sideDiamondCarats),
                sideDiamondQuantity: sourceQuote.sideDiamondQuantity,
                imageDataUrl: sourceQuote.analysis?.sourceImageStorageKey
                  ? `/api/quotes/${sourceQuote.id}/image`
                  : (sourceQuote.analysis?.imageDataUrl ?? null),
                analysisId: sourceQuote.analysisId ?? null,
                jewelryType: sourceQuote.analysis?.jewelryType ?? null,
                centerShape: sourceQuote.analysis?.centerShape ?? null,
                centerClarity: sourceQuote.analysis?.centerClarity ?? null,
                settingType: sourceQuote.analysis?.settingType ?? null,
                confidence: sourceQuote.analysis?.confidence ?? null,
                notes: sourceQuote.analysis?.notes ?? null,
                assumptions: Array.isArray(sourceQuote.analysis?.assumptions)
                  ? (sourceQuote.analysis?.assumptions as string[])
                  : null
              }
            : undefined
        }
      />
    </WorkspaceShell>
  );
}

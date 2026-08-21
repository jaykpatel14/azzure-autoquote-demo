import type { AiAnalysis, Company, PricingProfile } from "@prisma/client";
import { calculateMakingPrice } from "@/src/services/pricing";
import { getSettingValue } from "@/lib/app-settings";
import { resolveMetalPricing, normalizePricingProfile } from "@/lib/metal-pricing";

type AnalysisWithCompany = AiAnalysis & {
  company: Company & { pricingProfile: PricingProfile | null };
};

export async function computeAnalysisPricingBreakdown(analysis: AnalysisWithCompany) {
  // Admin audit tools should reflect today's live market rate, not the company's
  // static configured profile (which drifts from the market and is never
  // auto-synced) — otherwise the audit view silently shows stale spot prices.
  const baseProfile = analysis.company.pricingProfile
    ? normalizePricingProfile({
        goldSpotPerOz: Number(analysis.company.pricingProfile.goldSpotPerOz),
        platinumSpotPerOz: Number(analysis.company.pricingProfile.platinumSpotPerOz),
        silverSpotPerOz: Number(analysis.company.pricingProfile.silverSpotPerOz)
      })
    : undefined;
  const livePricing = await resolveMetalPricing(baseProfile);
  const goldSpot = Number(livePricing.pricingProfile.goldSpotPerOz);
  const platinumSpot = Number(livePricing.pricingProfile.platinumSpotPerOz);
  const silverSpot = Number(livePricing.pricingProfile.silverSpotPerOz);
  const hasSpec =
    analysis.status === "COMPLETED" &&
    analysis.metalWeightGrams != null &&
    analysis.centerDiamondCarats != null &&
    Number(analysis.centerDiamondCarats) > 0 &&
    Boolean(analysis.company.pricingTier);

  if (!hasSpec) {
    return {
      breakdown: null,
      goldSpot,
      platinumSpot,
      silverSpot,
      cadCost: 20,
      customerMarginPct: 0,
      detectedSideShape: "round" as const
    };
  }

  const rawCadCost = await getSettingValue("cad_cost_per_quote");
  const cadCost = rawCadCost !== undefined && rawCadCost !== null && Number(rawCadCost) > 0 ? Number(rawCadCost) : 20;
  const customerMarginPct = analysis.company.customerMarginPct ?? 0;
  const centerCarat = Math.max(Number(analysis.centerDiamondCarats), 0.0001);
  const sideDiamondQuantity = analysis.sideDiamondQuantity ?? 0;
  const sideDiamondCarats = Number(analysis.sideDiamondCarats ?? 0);

  const detectedSideShape =
    (analysis.output as any)?.sideStones?.[0]?.shape ||
    (analysis.centerShape &&
    ["emerald", "radiant", "cushion", "oval", "pear", "princess"].includes(analysis.centerShape.toLowerCase()) &&
    sideDiamondQuantity <= 4
      ? "fancy"
      : "round");

  const sideStones =
    sideDiamondQuantity > 0 && sideDiamondCarats > 0
      ? [
          {
            shape: detectedSideShape,
            caratWeightEach: sideDiamondCarats / sideDiamondQuantity,
            count: sideDiamondQuantity,
            settingType: analysis.settingType || "prong"
          }
        ]
      : [];

  const breakdown = calculateMakingPrice({
    metalType: analysis.selectedMetal,
    metalWeightGrams: Number(analysis.metalWeightGrams ?? 0),
    goldSpotPerOz: goldSpot,
    platinumSpotPerOz: platinumSpot,
    silverSpotPerOz: silverSpot,
    centerStone: { shape: analysis.centerShape || "round", caratWeight: centerCarat },
    sideStones,
    hasWeddingBand: false,
    isTwoTone: false,
    colorClarity: "E VS1",
    cadCost,
    pricingTier: analysis.company.pricingTier!,
    customerMarginPct
  });

  return { breakdown, goldSpot, platinumSpot, silverSpot, cadCost, customerMarginPct, detectedSideShape };
}

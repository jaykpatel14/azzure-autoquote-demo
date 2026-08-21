import type { AiAnalysis, Company, PricingProfile } from "@prisma/client";
import { calculateMakingPrice } from "@/src/services/pricing";
import { getSettingValue } from "@/lib/app-settings";

type AnalysisWithCompany = AiAnalysis & {
  company: Company & { pricingProfile: PricingProfile | null };
};

export async function computeAnalysisPricingBreakdown(analysis: AnalysisWithCompany) {
  const goldSpot = Number(analysis.company.pricingProfile?.goldSpotPerOz ?? 4500);
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
    centerStone: { shape: analysis.centerShape || "round", caratWeight: centerCarat },
    sideStones,
    hasWeddingBand: false,
    isTwoTone: false,
    colorClarity: "E VS1",
    cadCost,
    pricingTier: analysis.company.pricingTier!,
    customerMarginPct
  });

  return { breakdown, goldSpot, cadCost, customerMarginPct, detectedSideShape };
}

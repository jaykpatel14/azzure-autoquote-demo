import { type Prisma } from "@prisma/client";
import { CompanyAccessError } from "@/lib/company";
import { createQuote } from "@/src/services/quotes";
import { calculateMakingPrice, calculateTierPrice } from "@/src/services/pricing";
import { getSettingValue } from "@/lib/app-settings";
import { resolveMetalPricing, normalizePricingProfile } from "@/lib/metal-pricing";
import { quoteSchema, applyQuoteMode, deriveDefaultSideStones } from "@/lib/quote-input-schema";
import { getCompanyPlanFeatures } from "@/src/stripe/plans";
import { z } from "zod";

export async function processAndCreateQuote(
  companyContext: any,
  assignedCompanyId: string | null,
  body: unknown
) {
  const input = quoteSchema.parse(body);
  const company = companyContext.company;
  let features;
  if (assignedCompanyId !== "INTERNAL") {
    const plan = await getCompanyPlanFeatures(company.id);
    features = plan.features;
  } else {
    features = { canGenerateAIImages: true, canUseCustomPricingProfile: true } as any;
  }
  const allowCustomPricing = features.canUseCustomPricingProfile;

  if (!company.pricingTier) {
    throw new CompanyAccessError("Your account does not have a pricing tier assigned.");
  }

  const adjustedInput = applyQuoteMode(input);

  // 1. Fetch admin-configured CAD cost from platform settings
  const rawCadCost = await getSettingValue("cad_cost_per_quote");
  const cadCost = rawCadCost !== undefined && rawCadCost !== null && Number(rawCadCost) > 0 ? Number(rawCadCost) : 20;

  // 2. Fetch jeweler's margin percentage & live metal spot pricing
  const customerMarginPct = company.customerMarginPct ?? 0;
  const baseProfile = company.pricingProfile
    ? normalizePricingProfile({
        goldSpotPerOz: Number(company.pricingProfile.goldSpotPerOz),
        platinumSpotPerOz: Number(company.pricingProfile.platinumSpotPerOz),
        silverSpotPerOz: Number(company.pricingProfile.silverSpotPerOz),
        cadCharge: Number(company.pricingProfile.cadCharge),
        centerSettingPerCarat: Number(company.pricingProfile.centerSettingPerCarat),
        sideSettingPerStone: Number(company.pricingProfile.sideSettingPerStone),
        sellingMarginDivisor: Number(company.pricingProfile.sellingMarginDivisor),
        finalMultiplier: Number(company.pricingProfile.finalMultiplier)
      })
    : undefined;
  const livePricing = await resolveMetalPricing(allowCustomPricing ? baseProfile : null);

  // 3. Prepare side stones list
  const sideStonesList = deriveDefaultSideStones(adjustedInput);

  // 4. Calculate making price breakdown
  const centerCarat = Math.max(adjustedInput.centerDiamondCarats, 0.0001);
  const makingPriceBreakdown = calculateMakingPrice({
    pricingProfile: livePricing.pricingProfile,
    quantity: adjustedInput.quantity,
    stoneOrigin: adjustedInput.stoneOrigin,
    metalType: adjustedInput.metalType,
    metalWeightGrams: adjustedInput.metalWeightGrams,
    goldSpotPerOz: Number(livePricing.pricingProfile.goldSpotPerOz),
    platinumSpotPerOz: Number(livePricing.pricingProfile.platinumSpotPerOz),
    silverSpotPerOz: Number(livePricing.pricingProfile.silverSpotPerOz),
    centerStone: {
      shape: adjustedInput.centerShape || "round",
      caratWeight: centerCarat
    },
    sideStones: sideStonesList,
    hasWeddingBand: Boolean(adjustedInput.hasWeddingBand),
    isTwoTone: Boolean(adjustedInput.isTwoTone),
    colorClarity: adjustedInput.centerClarity || "E VS1",
    cadCost,
    pricingTier: company.pricingTier,
    customerMarginPct
  });

  // 5. Apply tier formula on top of production subtotal
  const tierResult = calculateTierPrice(
    makingPriceBreakdown.subtotal,
    company.pricingTier,
    customerMarginPct
  );

  // 6. Save quote
  const quoteResult = await createQuote({
    companyId: company.id,
    analysisId: input.analysisId,
    referenceAnalysisIds: input.analysisIds,
    customerName: adjustedInput.customerName,
    customerEmail: adjustedInput.customerEmail,
    customerPhone: adjustedInput.customerPhone,
    metalType: adjustedInput.metalType,
    metalWeightGrams: adjustedInput.metalWeightGrams,
    centerDiamondCarats: adjustedInput.centerDiamondCarats,
    sideDiamondCarats: adjustedInput.sideDiamondCarats,
    sideDiamondQuantity: adjustedInput.sideDiamondQuantity,
    centerShape: adjustedInput.centerShape !== undefined ? adjustedInput.centerShape || null : undefined,
    centerClarity: adjustedInput.centerClarity || "E VS1",
    settingType: adjustedInput.settingType !== undefined ? adjustedInput.settingType || null : undefined,
    jewelryType: adjustedInput.jewelryType !== undefined ? adjustedInput.jewelryType || null : undefined,
    imageDataUrl: adjustedInput.imageDataUrl || undefined,
    notes: adjustedInput.customerNotes || adjustedInput.notes || undefined,
    estimatedPrice: tierResult.estimatedSellingPrice,
    makingPrice: makingPriceBreakdown.makingPrice,
    makingPriceBreakdown: makingPriceBreakdown as unknown as Prisma.InputJsonValue,
    colorClarity: adjustedInput.centerClarity || "E VS1",
    cadCost: makingPriceBreakdown.cadCost,
    customerMarginPct: makingPriceBreakdown.customerMarginPct,
    customerMarginAmount: makingPriceBreakdown.customerMarginAmount,
    pricingTierSnapshot: tierResult.tier,
    tierDivisorSnapshot: tierResult.divisor,
    estimatedSellingPrice: tierResult.estimatedSellingPrice
  });

  if ("error" in quoteResult) {
    throw new Error(quoteResult.error.userMessage);
  }

  return { quoteResult, input, features };
}

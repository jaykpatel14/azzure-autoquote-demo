import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import {
  METAL_TYPES,
  calculateQuote,
  mergePricingProfiles,
  type PricingProfileInput
} from "@/lib/pricing";
import {
  requireCompanyContext,
  AuthRequiredError,
  CompanyAccessError,
  canCreateQuotes,
  isCompanyApproved,
  isCompanySuspended
} from "@/lib/company";
import { normalizePricingProfile, resolveMetalPricing } from "@/lib/metal-pricing";
import { createQuote } from "@/src/services/quotes";
import { calculateTierPrice } from "@/src/services/pricing";
import { assertBillableSubscription, BillingAccessError } from "@/lib/billing";
import { assertPlanFeature, getCompanyPlanFeatures, PlanError } from "@/src/stripe/plans";
import { generateQuoteRendering } from "@/lib/ai/quote-rendering";

const quoteModes = ["normal", "without-center", "without-center-and-side"] as const;

const pricingOverlaySchema = z
  .object({
    goldSpotPerOz: z.coerce.number().min(0).optional(),
    platinumSpotPerOz: z.coerce.number().min(0).optional(),
    silverSpotPerOz: z.coerce.number().min(0).optional(),
    cadCharge: z.coerce.number().min(0).optional(),
    centerSettingPerCarat: z.coerce.number().min(0).optional(),
    sideSettingPerStone: z.coerce.number().min(0).optional(),
    sellingMarginDivisor: z.coerce.number().min(0).optional(),
    finalMultiplier: z.coerce.number().min(0).optional()
  })
  .partial();

const quoteSchema = z.object({
  analysisId: z.string().optional(),
  customerName: z.union([z.string().trim().min(1).max(200), z.literal("")]).optional(),
  quoteMode: z.enum(quoteModes).default("normal"),
  metalType: z.enum(METAL_TYPES),
  metalWeightGrams: z.coerce.number().min(0),
  centerDiamondCarats: z.coerce.number().min(0),
  sideDiamondCarats: z.coerce.number().min(0),
  sideDiamondQuantity: z.coerce.number().int().min(0),
  centerShape: z.union([z.string().trim().max(120), z.literal("")]).optional(),
  centerClarity: z.union([z.string().trim().max(120), z.literal("")]).optional(),
  settingType: z.union([z.string().trim().max(120), z.literal("")]).optional(),
  pricingOverlay: pricingOverlaySchema.optional()
});

export async function POST(request: Request) {
  try {
    const companyContext = await requireCompanyContext();
    assertBillableSubscription(companyContext.company.subscription);
    await assertPlanFeature(companyContext.company.id, "canCreateQuotes");
    if (!canCreateQuotes(companyContext.membership?.role ?? "CUSTOMER")) {
      throw new CompanyAccessError("You do not have permission to create quotes.");
    }
    if (isCompanySuspended(companyContext.company)) {
      throw new CompanyAccessError("Your account has been suspended. Contact Azzure support.");
    }
    if (!isCompanyApproved(companyContext.company)) {
      throw new CompanyAccessError("Your account is pending approval. You cannot create quotes yet.");
    }
    const input = quoteSchema.parse(await request.json());
    const company = companyContext.company;
    const { features } = await getCompanyPlanFeatures(company.id);

    const pricingProfile = features.canUseCustomPricingProfile && company.pricingProfile
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

    const livePricing = await resolveMetalPricing(pricingProfile);

    const adjustedInput = applyQuoteMode(input);
    const effectivePricingProfile = mergePricingProfiles(
      livePricing.pricingProfile,
      features.canUseCustomPricingProfile ? input.pricingOverlay as Partial<PricingProfileInput> | undefined : undefined
    );

    const pricing = calculateQuote(
      {
        metalType: adjustedInput.metalType,
        metalWeightGrams: adjustedInput.metalWeightGrams,
        centerDiamondCarats: adjustedInput.centerDiamondCarats,
        sideDiamondCarats: adjustedInput.sideDiamondCarats,
        sideDiamondQuantity: adjustedInput.sideDiamondQuantity
      },
      effectivePricingProfile
    );

    if (!company.pricingTier) {
      throw new CompanyAccessError("Your account does not have a pricing tier assigned.");
    }

    const tierPricing = calculateTierPrice(pricing.makingCost, company.pricingTier);

    const quoteResult = await createQuote({
      companyId: company.id,
      analysisId: input.analysisId,
      customerName: adjustedInput.customerName,
      metalType: adjustedInput.metalType,
      metalWeightGrams: adjustedInput.metalWeightGrams,
      centerDiamondCarats: adjustedInput.centerDiamondCarats,
      sideDiamondCarats: adjustedInput.sideDiamondCarats,
      sideDiamondQuantity: adjustedInput.sideDiamondQuantity,
      centerShape: adjustedInput.centerShape !== undefined ? adjustedInput.centerShape || null : undefined,
      centerClarity: adjustedInput.centerClarity !== undefined ? adjustedInput.centerClarity || null : undefined,
      settingType: adjustedInput.settingType !== undefined ? adjustedInput.settingType || null : undefined,
      estimatedPrice: tierPricing.estimatedSellingPrice,
      makingPrice: tierPricing.makingPrice,
      pricingTierSnapshot: tierPricing.tier,
      tierDivisorSnapshot: tierPricing.divisor,
      estimatedSellingPrice: tierPricing.estimatedSellingPrice
    });

    if ("error" in quoteResult) {
      return NextResponse.json(
        { error: quoteResult.error.userMessage },
        { status: quoteResult.error.statusCode }
      );
    }

    const rendering = await generateQuoteRendering({
      quoteId: quoteResult.data.id,
      companyId: company.id
    });

    return NextResponse.json({
      id: quoteResult.data.id,
      quoteNumber: quoteResult.data.quoteNumber,
      estimatedPrice: Number(quoteResult.data.estimatedPrice),
      renderingStatus: rendering.status,
      renderingError: rendering.status === "FAILED" ? "The quote was saved, but its rendering could not be generated." : undefined
    });
  } catch (error) {
    if (error instanceof PlanError || error instanceof BillingAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof CompanyAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid request." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save quote." },
      { status: 400 }
    );
  }
}

function applyQuoteMode(input: z.infer<typeof quoteSchema>) {
  if (input.quoteMode === "without-center-and-side") {
    return {
      ...input,
      centerDiamondCarats: 0,
      sideDiamondCarats: 0,
      sideDiamondQuantity: 0
    };
  }

  if (input.quoteMode === "without-center") {
    return {
      ...input,
      centerDiamondCarats: 0
    };
  }

  return input;
}

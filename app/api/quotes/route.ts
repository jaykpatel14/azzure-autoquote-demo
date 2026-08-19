import { NextResponse } from "next/server";
import { type Prisma } from "@prisma/client";
import { ZodError, z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  METAL_TYPES
} from "@/lib/pricing";
import {
  requireCompanyContext,
  AuthRequiredError,
  CompanyAccessError,
  canCreateQuotes,
  isCompanyApproved,
  isCompanySuspended
} from "@/lib/company";
import { createQuote } from "@/src/services/quotes";
import { calculateMakingPrice, calculateTierPrice } from "@/src/services/pricing";
import { getSettingValue } from "@/lib/app-settings";
import { resolveMetalPricing, normalizePricingProfile } from "@/lib/metal-pricing";
import { assertBillableSubscription, BillingAccessError } from "@/lib/billing";


import { assertPlanFeature, getCompanyPlanFeatures, PlanError } from "@/src/stripe/plans";
import { generateQuoteRendering } from "@/lib/ai/quote-rendering";
import { loadQuoteRenderingDataUrlFromS3 } from "@/lib/quote-pdf-s3";

const quoteModes = ["normal", "without-center", "without-center-and-side"] as const;

const sideStoneItemSchema = z.object({
  shape: z.string().trim().default("round"),
  caratWeightEach: z.coerce.number().min(0),
  count: z.coerce.number().int().min(0),
  settingType: z.string().trim().default("prong")
});

const quoteSchema = z.object({
  analysisId: z.string().optional(),
  analysisIds: z.array(z.string()).max(12).optional(),
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
  customerNotes: z.string().max(1000).optional(),
  notes: z.string().max(1000).optional(),
  hasWeddingBand: z.boolean().optional().default(false),
  isTwoTone: z.boolean().optional().default(false),
  sideStones: z.array(sideStoneItemSchema).optional()
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
    const allowCustomPricing = features.canUseCustomPricingProfile;

    if (!company.pricingTier) {
      throw new CompanyAccessError("Your account does not have a pricing tier assigned.");
    }

    const adjustedInput = applyQuoteMode(input);

    // 1. Fetch admin-configured CAD cost from platform settings
    const cadCost = (await getSettingValue("cad_cost_per_quote")) ?? 0;

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
    let sideStonesList = adjustedInput.sideStones;
    if (!sideStonesList || sideStonesList.length === 0) {
      if (adjustedInput.sideDiamondQuantity > 0 && adjustedInput.sideDiamondCarats > 0) {
        sideStonesList = [
          {
            shape: "round",
            caratWeightEach: adjustedInput.sideDiamondCarats / adjustedInput.sideDiamondQuantity,
            count: adjustedInput.sideDiamondQuantity,
            settingType: adjustedInput.settingType || "prong"
          }
        ];
      } else {
        sideStonesList = [];
      }
    }

    // 4. Calculate making price breakdown
    const centerCarat = Math.max(adjustedInput.centerDiamondCarats, 0.0001);
    const makingPriceBreakdown = calculateMakingPrice({
      metalType: adjustedInput.metalType,
      metalWeightGrams: adjustedInput.metalWeightGrams,
      goldSpotPerOz: Number(livePricing.pricingProfile.goldSpotPerOz),
      centerStone: {
        shape: adjustedInput.centerShape || "round",
        caratWeight: centerCarat
      },
      sideStones: sideStonesList,
      hasWeddingBand: Boolean(adjustedInput.hasWeddingBand),
      isTwoTone: Boolean(adjustedInput.isTwoTone),
      colorClarity: "E VS1",
      cadCost,
      customerMarginPct
    });




    // 5. Apply tier formula on top of making price
    const tierResult = calculateTierPrice(
      makingPriceBreakdown.makingPrice,
      company.pricingTier
    );

    // 6. Save quote
    const quoteResult = await createQuote({
      companyId: company.id,
      analysisId: input.analysisId,
      referenceAnalysisIds: input.analysisIds,
      customerName: adjustedInput.customerName,
      metalType: adjustedInput.metalType,
      metalWeightGrams: adjustedInput.metalWeightGrams,
      centerDiamondCarats: adjustedInput.centerDiamondCarats,
      sideDiamondCarats: adjustedInput.sideDiamondCarats,
      sideDiamondQuantity: adjustedInput.sideDiamondQuantity,
      centerShape: adjustedInput.centerShape !== undefined ? adjustedInput.centerShape || null : undefined,
      centerClarity: "E VS1",
      settingType: adjustedInput.settingType !== undefined ? adjustedInput.settingType || null : undefined,
      notes: adjustedInput.customerNotes || adjustedInput.notes || undefined,
      estimatedPrice: tierResult.estimatedSellingPrice,
      makingPrice: makingPriceBreakdown.makingPrice,
      makingPriceBreakdown: makingPriceBreakdown as unknown as Prisma.InputJsonValue,
      colorClarity: "E VS1",
      cadCost: makingPriceBreakdown.cadCost,
      customerMarginPct: makingPriceBreakdown.customerMarginPct,
      customerMarginAmount: makingPriceBreakdown.customerMarginAmount,
      pricingTierSnapshot: tierResult.tier,
      tierDivisorSnapshot: tierResult.divisor,
      estimatedSellingPrice: tierResult.estimatedSellingPrice
    });

    if ("error" in quoteResult) {
      return NextResponse.json(
        { error: quoteResult.error.userMessage },
        { status: quoteResult.error.statusCode }
      );
    }

    let renderingImageUrl: string | null = null;
    let renderingStatus: "COMPLETED" | "FAILED" | "SKIPPED" = "SKIPPED";

    if (features.canGenerateAIImages) {
      // The analysis step already generates a rendering automatically. Reuse it
      // instead of paying for a second OpenAI image generation on save.
      const existingRendering = input.analysisId
        ? await prisma.aiAnalysis.findUnique({
            where: { id: input.analysisId },
            select: {
              renderingStatus: true,
              renderingStorageKey: true,
              renderingDataUrl: true,
              renderingMimeType: true,
              renderingModel: true,
              renderingCreatedAt: true
            }
          })
        : null;

      if (existingRendering?.renderingStatus === "COMPLETED") {
        await prisma.quote.update({
          where: { id: quoteResult.data.id },
          data: {
            renderingStatus: "COMPLETED",
            renderingStorageKey: existingRendering.renderingStorageKey,
            renderingDataUrl: existingRendering.renderingDataUrl,
            renderingMimeType: existingRendering.renderingMimeType,
            renderingModel: existingRendering.renderingModel,
            renderingCreatedAt: existingRendering.renderingCreatedAt
          }
        });
        renderingStatus = "COMPLETED";
        renderingImageUrl = existingRendering.renderingStorageKey
          ? await loadQuoteRenderingDataUrlFromS3(existingRendering.renderingStorageKey)
          : existingRendering.renderingDataUrl ?? null;
      } else {
        const rendering = await generateQuoteRendering({
          quoteId: quoteResult.data.id,
          companyId: company.id
        });
        renderingStatus = rendering.status;

        if (rendering.status === "COMPLETED") {
          const renderedQuote = await prisma.quote.findUnique({
            where: { id: quoteResult.data.id },
            select: { renderingStorageKey: true, renderingDataUrl: true }
          });
          renderingImageUrl = renderedQuote?.renderingStorageKey
            ? await loadQuoteRenderingDataUrlFromS3(renderedQuote.renderingStorageKey)
            : renderedQuote?.renderingDataUrl ?? null;
        }
      }
    }

    return NextResponse.json({
      id: quoteResult.data.id,
      quoteNumber: quoteResult.data.quoteNumber,
      estimatedPrice: Number(quoteResult.data.estimatedPrice),
      renderingStatus,
      renderingError: renderingStatus === "FAILED" ? "The quote was saved, but its rendering could not be generated." : undefined,
      renderingImageUrl
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
      sideDiamondQuantity: 0,
      sideStones: []
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

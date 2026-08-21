import { NextResponse, after } from "next/server";
import { type Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
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
import { quoteSchema, applyQuoteMode, deriveDefaultSideStones } from "@/lib/quote-input-schema";


import { assertPlanFeature, getCompanyPlanFeatures, PlanError } from "@/src/stripe/plans";
import { generateQuoteRendering } from "@/lib/ai/quote-rendering";
import { loadQuoteRenderingDataUrlFromS3 } from "@/lib/quote-pdf-s3";

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
      return NextResponse.json(
        { error: quoteResult.error.userMessage },
        { status: quoteResult.error.statusCode }
      );
    }

    let renderingImageUrl: string | null = null;
    let renderingStatus: "COMPLETED" | "SKIPPED" | "PROCESSING" = "SKIPPED";

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
        // No rendering to reuse — generating one fresh takes 30-75s (OpenAI image
        // round trip). Don't block the save response on it; that made saves look
        // hung and risked exceeding any upstream request timeout. Generate it in
        // the background instead; the quote's renderingStatus flips to COMPLETED
        // once it's ready and is picked up next time the quote is viewed.
        const quoteId = quoteResult.data.id;
        const companyId = company.id;
        after(() => {
          generateQuoteRendering({ quoteId, companyId }).catch(() => undefined);
        });
        renderingStatus = "PROCESSING";
      }
    }

    return NextResponse.json({
      id: quoteResult.data.id,
      quoteNumber: quoteResult.data.quoteNumber,
      estimatedPrice: Number(quoteResult.data.estimatedPrice),
      renderingStatus,
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

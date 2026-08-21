import { NextResponse, after } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { getActiveShowroom, nextShowroomCode } from "@/lib/showroom";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { reserveMonthlyUsage, consumeMonthlyUsage, releaseMonthlyUsage } from "@/lib/usage";
import { calculateMakingPrice, calculateTierPrice } from "@/src/services/pricing";
import { createQuote } from "@/src/services/quotes";
import { getSettingValue } from "@/lib/app-settings";
import { generateQuoteRendering } from "@/lib/ai/quote-rendering";
import { validateEmail } from "@/lib/email-validation";
import { resolveMetalPricing, normalizePricingProfile } from "@/lib/metal-pricing";
import { getCompanyPlanFeatures } from "@/src/stripe/plans";

const schema = z.object({
  token: z.string().min(20),
  analysisIds: z.array(z.string()).optional(),
  primaryAnalysisId: z.string().optional(),
  description: z.string().max(1000).optional(),
  customerNotes: z.string().max(1000).optional(),
  customerName: z.string().trim().min(1, "Customer name is required"),
  customerEmail: z.string().trim().min(1, "Customer email is required").superRefine((val, ctx) => {
    const check = validateEmail(val);
    if (!check.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: check.error || "Please enter a valid email address."
      });
    }
  }),
  customerPhone: z.string().trim().min(7, "Customer phone number is required"),
  metalType: z.string().optional(),
  selectedMetal: z.string().optional(),
  metalWeightGrams: z.number().min(0).default(5),
  centerDiamondCarats: z.number().min(0).optional(),
  centerCarats: z.number().min(0).optional(),
  sideDiamondCarats: z.number().min(0).optional(),
  sideCarats: z.number().min(0).optional(),
  sideDiamondQuantity: z.number().int().min(0).default(0),
  centerShape: z.string().optional(),
  settingType: z.string().optional(),
  hasWeddingBand: z.boolean().optional(),
  isTwoTone: z.boolean().optional(),
  estimatedPrice: z.number().optional(),
  renderingImageUrl: z.string().nullable().optional()
});

export async function POST(request: Request) {
  let reservation: { usagePeriodId: string; isOverage: boolean } | undefined;
  try {
    const input = schema.parse(await request.json());
    const resolvedMetal = input.metalType || input.selectedMetal || "14K";
    const resolvedCenterCarats = input.centerDiamondCarats ?? input.centerCarats ?? 0;
    const resolvedSideCarats = input.sideDiamondCarats ?? input.sideCarats ?? 0;
    const resolvedNotes = input.customerNotes || input.description || "";
    const analysisIdList = (input.analysisIds && input.analysisIds.length > 0)
      ? input.analysisIds
      : input.primaryAnalysisId ? [input.primaryAnalysisId] : [];

    const session = await getActiveShowroom(input.token);
    if (!session) return NextResponse.json({ error: "This kiosk is not active." }, { status: 401 });
    const rate = checkRateLimit({ key: `showroom:${session.id}`, limit: 10, windowMs: 60 * 60 * 1000 });
    if (!rate.allowed) return NextResponse.json({ error: "This kiosk has reached its hourly quote limit." }, { status: 429 });
    reservation = await reserveMonthlyUsage(session.companyId);
    const rawCadCost = await getSettingValue("cad_cost_per_quote");
    const cadCost = rawCadCost !== undefined && rawCadCost !== null && Number(rawCadCost) > 0 ? Number(rawCadCost) : 20;
    const margin = session.company.customerMarginPct ?? 0;
    const detectedSideShape = (input.centerShape && ["emerald", "radiant", "cushion", "oval", "pear", "princess"].includes(input.centerShape.toLowerCase()) && input.sideDiamondQuantity <= 4)
      ? "fancy"
      : "round";
    const sideStones = input.sideDiamondQuantity ? [{ shape: detectedSideShape, caratWeightEach: resolvedSideCarats / input.sideDiamondQuantity, count: input.sideDiamondQuantity, settingType: input.settingType || "prong" }] : [];
    if (!session.company.pricingTier) throw new Error("Pricing is not configured.");

    const { features } = await getCompanyPlanFeatures(session.companyId);
    const baseProfile = session.company.pricingProfile
      ? normalizePricingProfile({
          goldSpotPerOz: Number(session.company.pricingProfile.goldSpotPerOz),
          platinumSpotPerOz: Number(session.company.pricingProfile.platinumSpotPerOz),
          silverSpotPerOz: Number(session.company.pricingProfile.silverSpotPerOz),
          cadCharge: Number(session.company.pricingProfile.cadCharge),
          centerSettingPerCarat: Number(session.company.pricingProfile.centerSettingPerCarat),
          sideSettingPerStone: Number(session.company.pricingProfile.sideSettingPerStone),
          sellingMarginDivisor: Number(session.company.pricingProfile.sellingMarginDivisor),
          finalMultiplier: Number(session.company.pricingProfile.finalMultiplier)
        })
      : undefined;
    const livePricing = await resolveMetalPricing(features.canUseCustomPricingProfile ? baseProfile : null);

    const making = calculateMakingPrice({
      metalType: resolvedMetal,
      metalWeightGrams: input.metalWeightGrams,
      goldSpotPerOz: Number(livePricing.pricingProfile.goldSpotPerOz),
      platinumSpotPerOz: Number(livePricing.pricingProfile.platinumSpotPerOz),
      silverSpotPerOz: Number(livePricing.pricingProfile.silverSpotPerOz),
      centerStone: { shape: input.centerShape || "round", caratWeight: Math.max(resolvedCenterCarats, 0.0001) },
      sideStones,
      hasWeddingBand: Boolean(input.hasWeddingBand),
      isTwoTone: Boolean(input.isTwoTone),
      colorClarity: "E VS1",
      cadCost,
      pricingTier: session.company.pricingTier,
      customerMarginPct: margin
    });
    const tier = calculateTierPrice(making.subtotal, session.company.pricingTier, margin);
    const result = await createQuote({
      companyId: session.companyId,
      analysisId: analysisIdList[0] || undefined,
      referenceAnalysisIds: analysisIdList,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      metalType: resolvedMetal,
      metalWeightGrams: input.metalWeightGrams,
      centerDiamondCarats: resolvedCenterCarats,
      sideDiamondCarats: resolvedSideCarats,
      sideDiamondQuantity: input.sideDiamondQuantity,
      centerShape: input.centerShape,
      centerClarity: "E VS1",
      settingType: input.settingType,
      notes: resolvedNotes || undefined,
      estimatedPrice: tier.estimatedSellingPrice,
      makingPrice: making.makingPrice,
      makingPriceBreakdown: making as unknown as Prisma.InputJsonValue,
      colorClarity: "E VS1",
      cadCost: making.cadCost,
      customerMarginPct: making.customerMarginPct,
      customerMarginAmount: making.customerMarginAmount,
      pricingTierSnapshot: tier.tier,
      tierDivisorSnapshot: tier.divisor,
      estimatedSellingPrice: tier.estimatedSellingPrice
    });
    if ("error" in result) throw new Error(result.error.userMessage);
    const displayCode = await nextShowroomCode(session.companyId);
    await prisma.showroomQuote.create({ data: { companyId: session.companyId, quoteId: result.data.id, displayCode, customerNotes: resolvedNotes || null } });
    await consumeMonthlyUsage(reservation.usagePeriodId); reservation = undefined;

    // AI 3D rendering can take 30-75s (image generation round trip). Don't block the
    // save response on it — that made the kiosk look hung and risked exceeding any
    // upstream request timeout. Generate it in the background instead; the quote's
    // renderingStatus flips to COMPLETED once it's ready and is picked up wherever
    // the quote is viewed afterward.
    after(() => {
      generateQuoteRendering({ quoteId: result.data.id, companyId: session.companyId }).catch(() => undefined);
    });

    return NextResponse.json({
      code: displayCode,
      displayCode,
      estimatedPrice: tier.estimatedSellingPrice,
      estimatedSellingPrice: tier.estimatedSellingPrice,
      renderingStatus: "PROCESSING",
      renderingImageUrl: null
    });
  } catch (error) {
    if (reservation) await releaseMonthlyUsage(reservation.usagePeriodId).catch(() => undefined);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save quote." }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
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
import { loadQuoteRenderingDataUrlFromS3 } from "@/lib/quote-pdf-s3";

const schema = z.object({
  token: z.string().min(20),
  analysisIds: z.array(z.string()).min(1).max(3),
  customerNotes: z.string().max(1000).optional(),
  metalType: z.string().optional(),
  selectedMetal: z.string().optional(),
  metalWeightGrams: z.number().min(0),
  centerDiamondCarats: z.number().min(0),
  sideDiamondCarats: z.number().min(0),
  sideDiamondQuantity: z.number().int().min(0),
  centerShape: z.string().optional(),
  settingType: z.string().optional(),
  hasWeddingBand: z.boolean().optional(),
  isTwoTone: z.boolean().optional()
});

export async function POST(request: Request) {
  let reservation: { usagePeriodId: string; isOverage: boolean } | undefined;
  try {
    const input = schema.parse(await request.json());
    const resolvedMetal = input.metalType || input.selectedMetal || "14K";
    const session = await getActiveShowroom(input.token);
    if (!session) return NextResponse.json({ error: "This kiosk is not active." }, { status: 401 });
    const rate = checkRateLimit({ key: `showroom:${session.id}`, limit: 10, windowMs: 60 * 60 * 1000 });
    if (!rate.allowed) return NextResponse.json({ error: "This kiosk has reached its hourly quote limit." }, { status: 429 });
    reservation = await reserveMonthlyUsage(session.companyId);
    const cadCost = (await getSettingValue("cad_cost_per_quote")) ?? 0;
    const margin = session.company.customerMarginPct ?? 0;
    const sideStones = input.sideDiamondQuantity ? [{ shape: "round", caratWeightEach: input.sideDiamondCarats / input.sideDiamondQuantity, count: input.sideDiamondQuantity, settingType: input.settingType || "prong" }] : [];
    const making = calculateMakingPrice({
      metalType: resolvedMetal,
      metalWeightGrams: input.metalWeightGrams,
      centerStone: { shape: input.centerShape || "round", caratWeight: Math.max(input.centerDiamondCarats, 0.0001) },
      sideStones,
      hasWeddingBand: Boolean(input.hasWeddingBand),
      isTwoTone: Boolean(input.isTwoTone),
      colorClarity: "E VS1",
      cadCost,
      customerMarginPct: margin
    });
    if (!session.company.pricingTier) throw new Error("Pricing is not configured.");
    const tier = calculateTierPrice(making.makingPrice, session.company.pricingTier);
    const result = await createQuote({
      companyId: session.companyId,
      analysisId: input.analysisIds[0],
      referenceAnalysisIds: input.analysisIds,
      metalType: resolvedMetal,
      metalWeightGrams: input.metalWeightGrams,
      centerDiamondCarats: input.centerDiamondCarats,
      sideDiamondCarats: input.sideDiamondCarats,
      sideDiamondQuantity: input.sideDiamondQuantity,
      centerShape: input.centerShape,
      centerClarity: "E VS1",
      settingType: input.settingType,
      notes: input.customerNotes,
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
    await prisma.showroomQuote.create({ data: { companyId: session.companyId, quoteId: result.data.id, displayCode, customerNotes: input.customerNotes || null } });
    await consumeMonthlyUsage(reservation.usagePeriodId); reservation = undefined;
    const rendering = await generateQuoteRendering({ quoteId: result.data.id, companyId: session.companyId }).catch(() => ({ status: "FAILED" as const }));
    let renderingImageUrl: string | null = null;
    if (rendering.status === "COMPLETED") {
      const renderedQuote = await prisma.quote.findUnique({
        where: { id: result.data.id },
        select: { renderingStorageKey: true, renderingDataUrl: true }
      });
      renderingImageUrl = renderedQuote?.renderingStorageKey
        ? await loadQuoteRenderingDataUrlFromS3(renderedQuote.renderingStorageKey)
        : renderedQuote?.renderingDataUrl ?? null;
    }
    return NextResponse.json({
      displayCode,
      estimatedSellingPrice: tier.estimatedSellingPrice,
      renderingStatus: rendering.status,
      renderingImageUrl
    });
  } catch (error) {
    if (reservation) await releaseMonthlyUsage(reservation.usagePeriodId).catch(() => undefined);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save quote." }, { status: 400 });
  }
}

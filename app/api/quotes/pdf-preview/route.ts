import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireCompanyContext,
  AuthRequiredError,
  CompanyAccessError,
  canCreateQuotes
} from "@/lib/company";
import { calculateMakingPrice, calculateTierPrice } from "@/src/services/pricing";
import { getSettingValue } from "@/lib/app-settings";
import { resolveMetalPricing, normalizePricingProfile } from "@/lib/metal-pricing";
import { assertPlanFeature, getCompanyPlanFeatures, PlanError } from "@/src/stripe/plans";
import { generateQuotePdfBuffer } from "@/lib/pdf/quote";
import { loadAnalysisImageDataUrlFromS3 } from "@/lib/quote-pdf-s3";
import { quoteSchema, applyQuoteMode, deriveDefaultSideStones } from "@/lib/quote-input-schema";

export const runtime = "nodejs";

// Generates a PDF straight from in-memory draft/quote data, without requiring a
// saved Quote row. This is the fallback used when "Save Quote" fails (or before
// it's been saved at all) so a jeweler can always hand a customer a PDF.
export async function POST(request: Request) {
  try {
    const companyContext = await requireCompanyContext();
    await assertPlanFeature(companyContext.company.id, "canDownloadPDF");
    if (!canCreateQuotes(companyContext.membership?.role ?? "CUSTOMER")) {
      throw new CompanyAccessError("You do not have permission to view quote PDFs.");
    }

    const input = quoteSchema.parse(await request.json());
    const company = companyContext.company;
    const { features } = await getCompanyPlanFeatures(company.id);
    const allowCustomPricing = features.canUseCustomPricingProfile;

    if (!company.pricingTier) {
      throw new CompanyAccessError("Your account does not have a pricing tier assigned.");
    }

    const adjustedInput = applyQuoteMode(input);

    const rawCadCost = await getSettingValue("cad_cost_per_quote");
    const cadCost = rawCadCost !== undefined && rawCadCost !== null && Number(rawCadCost) > 0 ? Number(rawCadCost) : 20;
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

    const sideStonesList = deriveDefaultSideStones(adjustedInput);
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
      pricingTier: company.pricingTier,
      customerMarginPct
    });

    const tierResult = calculateTierPrice(makingPriceBreakdown.subtotal, company.pricingTier, customerMarginPct);

    // Pull the real reference/rendering images from the linked analysis when we
    // have one, same as a saved quote's PDF would show. Otherwise fall back to
    // whatever the client has in-hand (manual mode's uploaded photo).
    let sourceImageDataUrl: string | null = adjustedInput.imageDataUrl?.trim() || null;
    let renderingDataUrl: string | null = null;

    if (adjustedInput.analysisId) {
      const analysis = await prisma.aiAnalysis.findFirst({
        where: { id: adjustedInput.analysisId, companyId: company.id },
        select: {
          sourceImageStorageKey: true,
          sourceImageMimeType: true,
          imageDataUrl: true,
          renderingStorageKey: true,
          renderingDataUrl: true
        }
      });

      if (analysis) {
        sourceImageDataUrl =
          (analysis.sourceImageStorageKey
            ? await loadAnalysisImageDataUrlFromS3({
                key: analysis.sourceImageStorageKey,
                mimeType: analysis.sourceImageMimeType || "image/jpeg"
              })
            : null) ||
          analysis.imageDataUrl ||
          sourceImageDataUrl;

        renderingDataUrl =
          (analysis.renderingStorageKey
            ? await loadAnalysisImageDataUrlFromS3({ key: analysis.renderingStorageKey, mimeType: "image/jpeg" })
            : null) || analysis.renderingDataUrl || null;
      }
    }

    const buffer = await generateQuotePdfBuffer({
      companyName: company.name,
      quoteNumber: "DRAFT",
      createdAt: new Date(),
      customerName: adjustedInput.customerName?.trim() || company.name || "Customer",
      customerEmail: adjustedInput.customerEmail?.trim() || null,
      customerPhone: adjustedInput.customerPhone?.trim() || null,
      customerNotes: adjustedInput.customerNotes || adjustedInput.notes || null,
      customerImageDataUrl: sourceImageDataUrl,
      referenceImageDataUrls: sourceImageDataUrl ? [sourceImageDataUrl] : [],
      renderingDataUrl,
      metalType: adjustedInput.metalType,
      metalWeightGrams: adjustedInput.metalWeightGrams,
      centerDiamondCarats: adjustedInput.centerDiamondCarats,
      sideDiamondCarats: adjustedInput.sideDiamondCarats,
      sideDiamondQuantity: adjustedInput.sideDiamondQuantity,
      estimatedPrice: tierResult.estimatedSellingPrice,
      estimatedSellingPrice: tierResult.estimatedSellingPrice,
      jewelryType: adjustedInput.jewelryType || null,
      centerShape: adjustedInput.centerShape || null,
      centerClarity: "E VS1",
      settingType: adjustedInput.settingType || null,
      branding: features.pdfBranding,
      hasPdfImages: features.hasPdfImages
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="draft-quote.pdf"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    if (error instanceof PlanError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof CompanyAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid request." }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate PDF." },
      { status: 400 }
    );
  }
}

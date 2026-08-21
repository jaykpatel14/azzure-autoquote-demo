import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireInternalAdminContext, InternalAdminAccessError } from "@/lib/internal-admin";
import { computeAnalysisPricingBreakdown } from "@/lib/admin-analysis-pricing";
import { generateQuotePdfBuffer } from "@/lib/pdf/quote";
import { loadAnalysisImageDataUrlFromS3 } from "@/lib/quote-pdf-s3";

export const runtime = "nodejs";

const paramsSchema = z.object({
  analysisId: z.string().cuid()
});

type RouteContext = {
  params: Promise<{
    analysisId: string;
  }>;
};

// Lets an admin print/download a PDF for an AI analysis the customer/jeweler
// never saved as a real Quote — e.g. after a save-quote failure was reported.
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    await requireInternalAdminContext();

    const parsed = paramsSchema.safeParse(await params);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid analysis id." }, { status: 400 });
    }

    const analysis = await prisma.aiAnalysis.findUnique({
      where: { id: parsed.data.analysisId },
      include: { company: { include: { pricingProfile: true } } }
    });

    if (!analysis) {
      return NextResponse.json({ error: "Analysis not found." }, { status: 404 });
    }

    const { breakdown } = await computeAnalysisPricingBreakdown(analysis);
    if (!breakdown) {
      return NextResponse.json(
        { error: "This analysis is missing the specification fields needed to generate a PDF." },
        { status: 400 }
      );
    }

    const sourceImageDataUrl = analysis.sourceImageStorageKey
      ? await loadAnalysisImageDataUrlFromS3({
          key: analysis.sourceImageStorageKey,
          mimeType: analysis.sourceImageMimeType || "image/jpeg"
        })
      : analysis.imageDataUrl;

    const renderingDataUrl = analysis.renderingStorageKey
      ? await loadAnalysisImageDataUrlFromS3({ key: analysis.renderingStorageKey, mimeType: "image/jpeg" })
      : analysis.renderingDataUrl;

    const buffer = await generateQuotePdfBuffer({
      companyName: analysis.company.name,
      quoteNumber: `DRAFT-${analysis.id.slice(-6).toUpperCase()}`,
      createdAt: analysis.createdAt,
      customerName: analysis.company.name || "Walk-in Customer",
      customerNotes: analysis.notes || null,
      customerImageDataUrl: sourceImageDataUrl,
      referenceImageDataUrls: sourceImageDataUrl ? [sourceImageDataUrl] : [],
      renderingDataUrl,
      metalType: analysis.selectedMetal,
      metalWeightGrams: Number(analysis.metalWeightGrams ?? 0),
      centerDiamondCarats: Number(analysis.centerDiamondCarats ?? 0),
      sideDiamondCarats: Number(analysis.sideDiamondCarats ?? 0),
      sideDiamondQuantity: analysis.sideDiamondQuantity ?? 0,
      estimatedPrice: breakdown.estimatedSellingPrice,
      estimatedSellingPrice: breakdown.estimatedSellingPrice,
      jewelryType: analysis.jewelryType,
      centerShape: analysis.centerShape,
      centerClarity: analysis.centerClarity,
      settingType: analysis.settingType,
      // Admin printouts always get the full internal layout, regardless of the tenant's plan.
      branding: "white_label",
      hasPdfImages: true
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="unsaved-analysis-${analysis.id}.pdf"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    if (error instanceof InternalAdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate PDF." },
      { status: 500 }
    );
  }
}

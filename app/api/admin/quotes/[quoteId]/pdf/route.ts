import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireInternalAdminContext, InternalAdminAccessError } from "@/lib/internal-admin";
import { generateQuotePdfBuffer } from "@/lib/pdf/quote";
import { loadAnalysisImageDataUrlFromS3, loadQuoteRenderingDataUrlFromS3 } from "@/lib/quote-pdf-s3";

export const runtime = "nodejs";

const paramsSchema = z.object({
  quoteId: z.string().cuid()
});

type RouteContext = {
  params: Promise<{
    quoteId: string;
  }>;
};

// Admin-only PDF generation for a saved quote — bypasses the tenant's plan-feature
// gating so support staff can always print/download a copy, e.g. when a customer
// reports they were never able to download their PDF.
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    await requireInternalAdminContext();

    const parsed = paramsSchema.safeParse(await params);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid quote id." }, { status: 400 });
    }

    const quote = await prisma.quote.findUnique({
      where: { id: parsed.data.quoteId },
      include: { company: true, analysis: true }
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found." }, { status: 404 });
    }

    const sourceImageDataUrl = quote.analysis?.sourceImageStorageKey
      ? await loadAnalysisImageDataUrlFromS3({
          key: quote.analysis.sourceImageStorageKey,
          mimeType: quote.analysis.sourceImageMimeType || "image/jpeg"
        })
      : quote.analysis?.imageDataUrl ?? null;

    const renderKey = quote.renderingStorageKey || quote.analysis?.renderingStorageKey;
    const renderingDataUrl = renderKey
      ? await loadQuoteRenderingDataUrlFromS3(renderKey)
      : quote.renderingDataUrl || quote.analysis?.renderingDataUrl || null;

    const buffer = await generateQuotePdfBuffer({
      companyName: quote.company.name,
      quoteNumber: quote.quoteNumber,
      createdAt: quote.createdAt,
      customerName: quote.customerName?.trim() || quote.company.name || "Customer",
      customerEmail: quote.customerEmail?.trim() || null,
      customerPhone: quote.customerPhone?.trim() || null,
      customerNotes: quote.analysis?.notes || null,
      customerImageDataUrl: sourceImageDataUrl,
      referenceImageDataUrls: sourceImageDataUrl ? [sourceImageDataUrl] : [],
      renderingDataUrl,
      metalType: quote.metalType,
      metalWeightGrams: Number(quote.metalWeightGrams),
      centerDiamondCarats: Number(quote.centerDiamondCarats),
      sideDiamondCarats: Number(quote.sideDiamondCarats),
      sideDiamondQuantity: quote.sideDiamondQuantity,
      estimatedPrice: Number(quote.estimatedPrice),
      estimatedSellingPrice: quote.estimatedSellingPrice ? Number(quote.estimatedSellingPrice) : null,
      jewelryType: quote.analysis?.jewelryType,
      centerShape: quote.analysis?.centerShape,
      centerClarity: quote.analysis?.centerClarity,
      settingType: quote.analysis?.settingType,
      // Admin printouts always get the full internal layout, regardless of the tenant's plan.
      branding: "white_label",
      hasPdfImages: true
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${quote.quoteNumber}.pdf"`,
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

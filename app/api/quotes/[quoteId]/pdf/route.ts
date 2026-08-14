import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireCompanyContext,
  AuthRequiredError,
  CompanyAccessError,
  canViewQuotes
} from "@/lib/company";
import { generateQuotePdfBuffer } from "@/lib/pdf/quote";
import {
  buildQuotePdfStorageKey,
  loadAnalysisImageDataUrlFromS3,
  storeQuotePdfInS3
} from "@/lib/quote-pdf-s3";
import { getQuote } from "@/src/services/quotes";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    quoteId: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const context = await requireCompanyContext();
    if (!canViewQuotes(context.membership?.role ?? "CUSTOMER")) {
      throw new CompanyAccessError("You do not have permission to view quote PDFs.");
    }
    const { quoteId } = await params;

    const quoteResult = await getQuote({
      quoteId,
      companyId: context.company.id
    });

    if ("error" in quoteResult) {
      return NextResponse.json(
        { error: quoteResult.error.userMessage },
        { status: quoteResult.error.statusCode }
      );
    }

    const customerImageDataUrl = quoteResult.data.analysis?.sourceImageStorageKey
      ? (await loadAnalysisImageDataUrlFromS3({
          key: quoteResult.data.analysis.sourceImageStorageKey,
          mimeType: quoteResult.data.analysis.sourceImageMimeType || "image/jpeg"
        })) || quoteResult.data.analysis.imageDataUrl
      : quoteResult.data.analysis?.imageDataUrl;

    const pdfBuffer = await generateQuotePdfBuffer({
      companyName: quoteResult.data.company.name,
      quoteNumber: quoteResult.data.quoteNumber,
      createdAt: quoteResult.data.createdAt,
      customerName: quoteResult.data.customerName?.trim() || quoteResult.data.company.name || context.user.name || "Customer",
      customerImageDataUrl,
      metalType: quoteResult.data.metalType,
      metalWeightGrams: Number(quoteResult.data.metalWeightGrams),
      centerDiamondCarats: Number(quoteResult.data.centerDiamondCarats),
      sideDiamondCarats: Number(quoteResult.data.sideDiamondCarats),
      sideDiamondQuantity: quoteResult.data.sideDiamondQuantity,
      estimatedPrice: Number(quoteResult.data.estimatedPrice),
      estimatedSellingPrice: quoteResult.data.estimatedSellingPrice
        ? Number(quoteResult.data.estimatedSellingPrice)
        : null,
      jewelryType: quoteResult.data.analysis?.jewelryType,
      centerShape: quoteResult.data.analysis?.centerShape
    });

    const storageKey = buildQuotePdfStorageKey(context.company.id, quoteResult.data.quoteNumber);
    const stored = await storeQuotePdfInS3({
      key: storageKey,
      buffer: pdfBuffer
    });

    if (stored) {
      await prisma.quote
        .update({
          where: { id: quoteResult.data.id },
          data: {
            pdfStorageKey: stored.key,
            pdfStoredAt: new Date(),
            pdfContentType: "application/pdf"
          }
        })
        .catch(() => undefined);
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${quoteResult.data.quoteNumber}.pdf"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof CompanyAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate PDF." },
      { status: 400 }
    );
  }
}

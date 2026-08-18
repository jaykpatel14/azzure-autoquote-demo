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
  deleteQuotePdfFromS3,
  buildQuotePdfStorageKey,
  loadAnalysisImageDataUrlFromS3,
  loadQuoteRenderingDataUrlFromS3,
  storeQuotePdfInS3
} from "@/lib/quote-pdf-s3";
import { getQuote } from "@/src/services/quotes";
import { assertPlanFeature, getCompanyPlanFeatures, PlanError } from "@/src/stripe/plans";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    quoteId: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const context = await requireCompanyContext();
    await assertPlanFeature(context.company.id, "canDownloadPDF");
    const { features } = await getCompanyPlanFeatures(context.company.id);
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

    const sourceImageDataUrl = quoteResult.data.analysis?.sourceImageStorageKey
      ? (await loadAnalysisImageDataUrlFromS3({
          key: quoteResult.data.analysis.sourceImageStorageKey,
          mimeType: quoteResult.data.analysis.sourceImageMimeType || "image/jpeg"
        })) || quoteResult.data.analysis.imageDataUrl
      : quoteResult.data.analysis?.imageDataUrl;
    const referenceAnalysisIds = Array.isArray(quoteResult.data.referenceAnalysisIds)
      ? quoteResult.data.referenceAnalysisIds.filter((value): value is string => typeof value === "string")
      : [];
    const referenceAnalyses = referenceAnalysisIds.length
      ? await prisma.aiAnalysis.findMany({
          where: { id: { in: referenceAnalysisIds }, companyId: context.company.id },
          select: {
            id: true,
            sourceImageStorageKey: true,
            sourceImageMimeType: true,
            imageDataUrl: true
          }
        })
      : [];
    const referenceById = new Map(referenceAnalyses.map((analysis) => [analysis.id, analysis]));
    const referenceImageDataUrls = (
      await Promise.all(
        referenceAnalysisIds.map(async (analysisId) => {
          const analysis = referenceById.get(analysisId);
          if (!analysis) return null;
          return analysis.sourceImageStorageKey
            ? (await loadAnalysisImageDataUrlFromS3({
                key: analysis.sourceImageStorageKey,
                mimeType: analysis.sourceImageMimeType || "image/jpeg"
              })) || analysis.imageDataUrl
            : analysis.imageDataUrl;
        })
      )
    ).filter((value): value is string => Boolean(value));
    const renderingDataUrl = quoteResult.data.renderingStorageKey
      ? await loadQuoteRenderingDataUrlFromS3(quoteResult.data.renderingStorageKey)
      : quoteResult.data.renderingDataUrl;

    const pdfBuffer = await generateQuotePdfBuffer({
      companyName: quoteResult.data.company.name,
      quoteNumber: quoteResult.data.quoteNumber,
      createdAt: quoteResult.data.createdAt,
      customerName: quoteResult.data.customerName?.trim() || quoteResult.data.company.name || context.user.name || "Customer",
      customerImageDataUrl: sourceImageDataUrl,
      referenceImageDataUrls: referenceImageDataUrls.length
        ? referenceImageDataUrls
        : sourceImageDataUrl
          ? [sourceImageDataUrl]
          : [],
      renderingDataUrl,
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
      centerShape: quoteResult.data.analysis?.centerShape,
      centerClarity: quoteResult.data.analysis?.centerClarity,
      settingType: quoteResult.data.analysis?.settingType
      ,branding: features.pdfBranding
    });

    const storageKey = buildQuotePdfStorageKey(context.company.id, quoteResult.data.quoteNumber);
    const stored = features.s3ImagePersistence ? await storeQuotePdfInS3({
      key: storageKey,
      buffer: pdfBuffer
    }) : null;

    // Always mark quote as sent (pdfStoredAt set) when PDF is generated,
    // regardless of whether S3 persistence succeeded
    const updateData: any = {
      pdfStoredAt: new Date(),
      pdfContentType: "application/pdf"
    };
    if (stored) {
      updateData.pdfStorageKey = stored.key;
    }
    
    await prisma.quote
      .update({
        where: { id: quoteResult.data.id },
        data: updateData
      })
      .catch((error) => {
        console.error('Failed to update quote pdfStoredAt:', error);
      });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${quoteResult.data.quoteNumber}.pdf"`,
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

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate PDF." },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const context = await requireCompanyContext();
    const { quoteId } = await params;

    const quote = await prisma.quote.findFirst({
      where: {
        id: quoteId,
        companyId: context.company.id
      },
      select: {
        id: true,
        pdfStorageKey: true,
        quoteNumber: true,
        companyId: true
      }
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found." }, { status: 404 });
    }

    const storageKey = quote.pdfStorageKey || buildQuotePdfStorageKey(quote.companyId, quote.quoteNumber);
    await deleteQuotePdfFromS3(storageKey).catch(() => undefined);

    await prisma.quote.update({
      where: { id: quote.id },
      data: {
        pdfStorageKey: null,
        pdfStoredAt: null,
        pdfContentType: null
      }
    });

    return NextResponse.json({
      ok: true,
      quoteNumber: quote.quoteNumber
    });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof CompanyAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete PDF." },
      { status: 400 }
    );
  }
}

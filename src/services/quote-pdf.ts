import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateQuotePdfBuffer } from "@/lib/pdf/quote";
import {
  buildQuotePdfStorageKey,
  loadAnalysisImageDataUrlFromS3,
  loadQuoteRenderingDataUrlFromS3,
  storeQuotePdfInS3
} from "@/lib/quote-pdf-s3";
import { getQuote } from "@/src/services/quotes";
import { getCompanyPlanFeatures } from "@/src/stripe/plans";
import type { AppResult } from "@/src/lib/errors";

export async function generateAndStoreQuotePdf(params: {
  quoteId: string;
  companyId: string;
  customerNameFallback?: string | null;
}): Promise<AppResult<{ buffer: Buffer; quoteNumber: string }>> {
  const quoteResult = await getQuote({ quoteId: params.quoteId, companyId: params.companyId });
  if ("error" in quoteResult) {
    return quoteResult;
  }
  const quote = quoteResult.data;
  const { features } = await getCompanyPlanFeatures(params.companyId);

  const sourceImageDataUrl = quote.analysis?.sourceImageStorageKey
    ? (await loadAnalysisImageDataUrlFromS3({
        key: quote.analysis.sourceImageStorageKey,
        mimeType: quote.analysis.sourceImageMimeType || "image/jpeg"
      })) || quote.analysis.imageDataUrl
    : quote.analysis?.imageDataUrl;

  const referenceAnalysisIds = Array.isArray(quote.referenceAnalysisIds)
    ? quote.referenceAnalysisIds.filter((value): value is string => typeof value === "string")
    : [];
  const referenceAnalyses = referenceAnalysisIds.length
    ? await prisma.aiAnalysis.findMany({
        where: { id: { in: referenceAnalysisIds }, companyId: params.companyId },
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

  const renderingDataUrl = quote.renderingStorageKey
    ? await loadQuoteRenderingDataUrlFromS3(quote.renderingStorageKey)
    : quote.renderingDataUrl;

  const buffer = await generateQuotePdfBuffer({
    companyName: quote.company.name,
    quoteNumber: quote.quoteNumber,
    createdAt: quote.createdAt,
    customerName: quote.customerName?.trim() || quote.company.name || params.customerNameFallback || "Customer",
    customerEmail: quote.customerEmail?.trim() || null,
    customerPhone: quote.customerPhone?.trim() || null,
    customerNotes: quote.analysis?.notes || null,
    customerImageDataUrl: sourceImageDataUrl,
    referenceImageDataUrls: referenceImageDataUrls.length
      ? referenceImageDataUrls
      : sourceImageDataUrl
        ? [sourceImageDataUrl]
        : [],
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
    branding: features.pdfBranding,
    hasPdfImages: features.hasPdfImages
  });

  const storageKey = buildQuotePdfStorageKey(params.companyId, quote.quoteNumber);
  const stored = features.s3ImagePersistence ? await storeQuotePdfInS3({ key: storageKey, buffer }) : null;

  const updateData: Prisma.QuoteUpdateInput = {
    pdfStoredAt: new Date(),
    pdfContentType: "application/pdf"
  };
  if (stored) {
    updateData.pdfStorageKey = stored.key;
  }

  await prisma.quote.update({ where: { id: quote.id }, data: updateData }).catch((error) => {
    console.error("Failed to update quote pdfStoredAt:", error);
  });

  return { data: { buffer, quoteNumber: quote.quoteNumber } };
}

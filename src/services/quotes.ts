import { Prisma, type PricingTier, type Quote } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { allocateQuoteNumber } from "@/lib/quote-number";
import { NotFoundError, ConflictError, type AppResult } from "@/src/lib/errors";
import { assertPlanFeature } from "@/src/stripe/plans";
import { CompanyAccessError } from "@/lib/company";
import { buildBrandedPublicUrl } from "@/lib/security";
import type { MakingPriceBreakdown } from "@/src/services/pricing";

async function assertApprovedCompany(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { accountStatus: true, pricingTier: true } });
  if (!company || company.accountStatus !== "APPROVED" || !company.pricingTier) throw new CompanyAccessError("Account approval and a pricing tier are required.");
  return company;
}

type CreateQuoteInput = {
  companyId: string;
  analysisId?: string;
  referenceAnalysisIds?: string[];
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  metalType: string;
  metalWeightGrams: number;
  centerDiamondCarats: number;
  sideDiamondCarats: number;
  sideDiamondQuantity: number;
  estimatedPrice: number;
  makingPrice?: number | null;
  makingPriceBreakdown?: Prisma.InputJsonValue | null;
  colorClarity?: string;
  cadCost?: number;
  customerMarginPct?: number;
  customerMarginAmount?: number;
  pricingTierSnapshot?: PricingTier | null;
  tierDivisorSnapshot?: number | null;
  estimatedSellingPrice?: number | null;
  centerShape?: string | null;
  centerClarity?: string | null;
  settingType?: string | null;
  jewelryType?: string | null;
  imageDataUrl?: string | null;
  notes?: string | null;
};

type QuotePayload = Quote & {
  company: {
    name: string;
  };
  order: {
    id: string;
    orderNumber: string;
    status: string;
  } | null;
  analysis: {
    jewelryType: string | null;
    centerShape: string | null;
    centerClarity: string | null;
    settingType: string | null;
    confidence: string | null;
    notes: string | null;
    imageDataUrl: string | null;
    sourceImageStorageKey: string | null;
    sourceImageMimeType: string | null;
    assumptions: Prisma.JsonValue | null;
  } | null;
};

export type QuoteHistoryFilter = "all" | "draft" | "sent" | "ordered" | "expired";

export type QuoteHistoryRow = {
  id: string;
  recordType: "quote" | "analysis";
  quoteNumber: string;
  customerName: string | null;
  metalType: string;
  estimatedPrice: number | null;
  createdAt: Date;
  pdfStoredAt: Date | null;
  thumbnailUrl: string | null;
  status: Exclude<QuoteHistoryFilter, "all">;
  displayStatus: string;
  costBreakdown?: MakingPriceBreakdown | null;
};

export type QuoteHistoryPage = {
  quotes: QuoteHistoryRow[];
  totalQuotes: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  query: string;
  status: QuoteHistoryFilter;
  counts: Record<Exclude<QuoteHistoryFilter, "all">, number>;
};

function getDaysOld(createdAt: Date, now = new Date()) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((now.getTime() - createdAt.getTime()) / msPerDay);
}

export function deriveQuoteStatus(
  quote: Pick<Quote, "createdAt" | "pdfStoredAt"> & { order?: { id: string } | null }
): Exclude<QuoteHistoryFilter, "all"> {
  if (quote.order) {
    return "ordered";
  }

  if (quote.pdfStoredAt) {
    return "sent";
  }

  if (getDaysOld(quote.createdAt) > 30) {
    return "expired";
  }

  return "draft";
}

export function getQuotePublicUrl(token: string) {
  return `/q/${token}`;
}

export function getBrandedQuotePublicUrl(companySlug: string, token: string) {
  return buildBrandedPublicUrl(companySlug, `/q/${token}`);
}

export async function createQuote(
  input: CreateQuoteInput
): Promise<AppResult<Quote>> {
  const company = await prisma.company.findUnique({ where: { id: input.companyId }, select: { accountStatus: true, pricingTier: true } });
  if (!company || company.accountStatus !== "APPROVED" || !company.pricingTier) {
    return { error: ConflictError("Account approval and a pricing tier are required to create quotes.") };
  }
  const usage = await prisma.usagePeriod.findFirst({
    where: { companyId: input.companyId, periodStart: { lte: new Date() }, periodEnd: { gt: new Date() } },
    orderBy: { periodStart: "desc" }, select: { used: true, limit: true }
  });
  let analysis = null;
  let resolvedAnalysisId = input.analysisId;

  if (resolvedAnalysisId && !resolvedAnalysisId.startsWith("product-") && !resolvedAnalysisId.startsWith("concept-")) {
    const candidate = await prisma.aiAnalysis.findFirst({
      where: { id: resolvedAnalysisId }
    });

    if (!candidate || candidate.companyId !== input.companyId) {
      return { error: NotFoundError("Selected estimate") };
    }

    analysis = candidate;

    // Check if this analysis is already attached to an existing Quote (since Quote.analysisId is @unique)
    const existingQuote = await prisma.quote.findUnique({
      where: { analysisId: analysis.id },
      select: { id: true }
    });

    if (existingQuote) {
      // Clone analysis to prevent unique constraint violation
      const cloned = await prisma.aiAnalysis.create({
        data: {
          companyId: input.companyId,
          provider: analysis.provider,
          model: analysis.model,
          modelVersion: analysis.modelVersion,
          promptVersion: analysis.promptVersion,
          selectedMetal: input.metalType || analysis.selectedMetal,
          jewelryType: analysis.jewelryType || "Ring",
          centerShape: input.centerShape || analysis.centerShape,
          centerClarity: input.colorClarity || analysis.centerClarity || "E VS1",
          settingType: input.settingType || analysis.settingType,
          metalWeightGrams: input.metalWeightGrams,
          centerDiamondCarats: input.centerDiamondCarats,
          sideDiamondCarats: input.sideDiamondCarats,
          sideDiamondQuantity: input.sideDiamondQuantity,
          confidence: analysis.confidence,
          notes: input.notes || analysis.notes,
          imageDataUrl: analysis.imageDataUrl,
          sourceImageStorageKey: analysis.sourceImageStorageKey,
          sourceImageMimeType: analysis.sourceImageMimeType,
          sourceImageSizeBytes: analysis.sourceImageSizeBytes,
          renderingStatus: analysis.renderingStatus,
          renderingStorageKey: analysis.renderingStorageKey,
          renderingDataUrl: analysis.renderingDataUrl,
          renderingMimeType: analysis.renderingMimeType,
          renderingModel: analysis.renderingModel,
          status: "COMPLETED",
          completedAt: new Date()
        }
      });
      analysis = cloned;
      resolvedAnalysisId = cloned.id;
    }
  }

  // If no analysis exists (e.g. preset product or manual direct quote), create a completed AiAnalysis record
  if (!analysis) {
    analysis = await prisma.aiAnalysis.create({
      data: {
        companyId: input.companyId,
        provider: "manual-quote-direct",
        model: "manual-v1",
        modelVersion: "manual-v1",
        promptVersion: "manual-v1",
        selectedMetal: input.metalType,
        jewelryType: input.jewelryType || "Ring",
        centerShape: input.centerShape || "round",
        centerClarity: input.colorClarity || "E VS1",
        settingType: input.settingType || "prong",
        metalWeightGrams: input.metalWeightGrams,
        centerDiamondCarats: input.centerDiamondCarats,
        sideDiamondCarats: input.sideDiamondCarats,
        sideDiamondQuantity: input.sideDiamondQuantity,
        confidence: "high",
        notes: input.notes || "Manual jeweler direct quote",
        imageDataUrl: input.imageDataUrl || null,
        status: "COMPLETED",
        completedAt: new Date()
      }
    });
    resolvedAnalysisId = analysis.id;
  }

  const referenceAnalyses = input.referenceAnalysisIds?.length
    ? await prisma.aiAnalysis.findMany({
        where: { id: { in: input.referenceAnalysisIds.filter((id) => !id.startsWith("product-")) }, companyId: input.companyId },
        select: { id: true }
      })
    : [];

  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const quote = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const quoteNumber = await allocateQuoteNumber(tx, input.companyId);

        if (
          analysis &&
          (input.centerShape !== undefined ||
            input.centerClarity !== undefined ||
            input.settingType !== undefined ||
            input.notes !== undefined)
        ) {
          await tx.aiAnalysis.update({
            where: { id: analysis.id },
            data: {
              ...(input.centerShape !== undefined ? { centerShape: input.centerShape || null } : {}),
              ...(input.centerClarity !== undefined ? { centerClarity: input.centerClarity || null } : {}),
              ...(input.settingType !== undefined ? { settingType: input.settingType || null } : {}),
              ...(input.notes !== undefined ? { notes: input.notes || null } : {})
            }
          });
        }

        return tx.quote.create({
          data: {
            companyId: input.companyId,
            quoteNumber,
            analysisId: resolvedAnalysisId,
            referenceAnalysisIds: referenceAnalyses.length
              ? referenceAnalyses.map((reference) => reference.id)
              : undefined,
            customerName: input.customerName || null,
            customerEmail: input.customerEmail || null,
            customerPhone: input.customerPhone || null,
            metalType: input.metalType,
            metalWeightGrams: input.metalWeightGrams,
            centerDiamondCarats: input.centerDiamondCarats,
            sideDiamondCarats: input.sideDiamondCarats,
            sideDiamondQuantity: input.sideDiamondQuantity,
            estimatedPrice: input.estimatedPrice,
            makingPrice: input.makingPrice ?? null,
            makingPriceBreakdown: input.makingPriceBreakdown ?? undefined,
            colorClarity: input.colorClarity ?? "E VS1",
            cadCost: input.cadCost ?? 0,
            customerMarginPct: input.customerMarginPct ?? 0,
            customerMarginAmount: input.customerMarginAmount ?? 0,
            pricingTierSnapshot: input.pricingTierSnapshot ?? null,
            tierDivisorSnapshot: input.tierDivisorSnapshot ?? null,
            estimatedSellingPrice: input.estimatedSellingPrice ?? null,
            isOverage: Boolean(usage && usage.used > usage.limit),
            notes: input.notes ?? null
          }
        });
      });

      return { data: quote };
    } catch (error) {
      const isUniqueQuoteNumberError =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        (error.meta?.target as string[] | string | undefined)?.toString().includes("companyId,quoteNumber");

      if (!isUniqueQuoteNumberError || attempt === maxAttempts) {
        return {
          error: ConflictError("Unable to save quote right now. Please try again.", error)
        };
      }
    }
  }

  return {
    error: ConflictError("Unable to save quote right now. Please try again.")
  };
}

export async function getQuote(params: {
  quoteId: string;
  companyId: string;
}): Promise<AppResult<QuotePayload>> {
  await assertApprovedCompany(params.companyId);
  const quote = await prisma.quote.findFirst({
    where: {
      id: params.quoteId,
      companyId: params.companyId
    },
    include: {
      company: {
        select: {
          name: true,
          logoUrl: true
        }
      },
      analysis: {
        select: {
          jewelryType: true,
          centerShape: true,
          centerClarity: true,
          settingType: true,
          confidence: true,
          notes: true,
          imageDataUrl: true,
          sourceImageStorageKey: true,
          sourceImageMimeType: true,
          assumptions: true
        }
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true
        }
      }
    }
  });

  if (!quote) {
    return { error: NotFoundError("Quote") };
  }

  return { data: quote };
}

export async function getQuoteHistoryPage(params: {
  companyId: string;
  page?: number;
  pageSize?: number;
  query?: string;
  status?: QuoteHistoryFilter;
}): Promise<QuoteHistoryPage> {
  await assertApprovedCompany(params.companyId);
  await assertPlanFeature(params.companyId, "canViewQuoteHistory");
  const pageSize = params.pageSize ?? 20;
  const query = (params.query ?? "").trim();
  const status = params.status ?? "all";
  const page = Math.max(1, params.page ?? 1);

  const [quotes, unsavedAnalyses] = await Promise.all([
    prisma.quote.findMany({
      where: { companyId: params.companyId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        quoteNumber: true,
        customerName: true,
        metalType: true,
        estimatedPrice: true,
        estimatedSellingPrice: true,
        makingPriceBreakdown: true,
        createdAt: true,
        pdfStoredAt: true,
        analysis: {
          select: {
            imageDataUrl: true,
            sourceImageStorageKey: true
          }
        },
        order: {
          select: {
            id: true
          }
        }
      }
    }),
    prisma.aiAnalysis.findMany({
      where: { companyId: params.companyId, quote: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        selectedMetal: true,
        status: true,
        errorMessage: true,
        createdAt: true,
        imageDataUrl: true,
        sourceImageStorageKey: true
      }
    })
  ]);

  const historyRows: QuoteHistoryRow[] = [
    ...quotes.map((quote) => ({
      id: quote.id,
      recordType: "quote" as const,
      quoteNumber: quote.quoteNumber,
      customerName: quote.customerName,
      metalType: quote.metalType,
      estimatedPrice: Number(quote.estimatedSellingPrice ?? quote.estimatedPrice),
      createdAt: quote.createdAt,
      pdfStoredAt: quote.pdfStoredAt,
      thumbnailUrl: quote.analysis
        ? quote.analysis.sourceImageStorageKey
          ? `/api/quotes/${quote.id}/image`
          : quote.analysis.imageDataUrl ?? null
        : null,
      status: deriveQuoteStatus(quote),
      displayStatus: deriveQuoteStatus(quote),
      costBreakdown: quote.makingPriceBreakdown && typeof quote.makingPriceBreakdown === "object"
        ? quote.makingPriceBreakdown as unknown as MakingPriceBreakdown
        : null
    })),
    ...unsavedAnalyses.map((analysis) => ({
      id: analysis.id,
      recordType: "analysis" as const,
      quoteNumber: `Analysis ${analysis.id.slice(-6).toUpperCase()}`,
      customerName: null,
      metalType: analysis.selectedMetal,
      estimatedPrice: null,
      createdAt: analysis.createdAt,
      pdfStoredAt: null,
      thumbnailUrl: analysis.sourceImageStorageKey
        ? `/api/analyze/${analysis.id}/image`
        : analysis.imageDataUrl ?? null,
      status: "draft" as const,
      displayStatus:
        analysis.status === "FAILED"
          ? "Analysis failed"
          : analysis.status === "COMPLETED"
            ? "Unsaved"
            : analysis.status.toLowerCase(),
      costBreakdown: null
    }))
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const normalizedQuery = query.toLowerCase();
  const statusFiltered = historyRows.filter((row) => status === "all" || row.status === status);
  const filtered = statusFiltered.filter((row) => {
    if (!normalizedQuery) return true;

    const haystack = [
      row.quoteNumber,
      row.customerName ?? "",
      row.metalType,
      row.estimatedPrice?.toString() ?? "",
      row.displayStatus
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });

  const counts = historyRows.reduce(
    (acc, row) => {
      acc[row.status] += 1;
      return acc;
    },
    { draft: 0, sent: 0, ordered: 0, expired: 0 }
  );

  const totalQuotes = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalQuotes / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageQuotes = filtered.slice(start, start + pageSize);

  return {
    quotes: pageQuotes,
    totalQuotes,
    currentPage,
    totalPages,
    pageSize,
    query,
    status,
    counts
  };
}

export async function deleteQuote(params: {
  quoteId: string;
  companyId: string;
}): Promise<AppResult<{ quoteId: string }>> {
  const quote = await prisma.quote.findFirst({
    where: {
      id: params.quoteId,
      companyId: params.companyId
    },
    select: { id: true }
  });

  if (!quote) {
    return { error: NotFoundError("Quote") };
  }

  await prisma.quote.delete({
    where: { id: quote.id }
  });

  return { data: { quoteId: quote.id } };
}

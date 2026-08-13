import { Prisma, type Quote } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { allocateQuoteNumber } from "@/lib/quote-number";
import { NotFoundError, ConflictError, type AppResult } from "@/src/lib/errors";

type CreateQuoteInput = {
  companyId: string;
  analysisId?: string;
  customerName?: string | null;
  metalType: string;
  metalWeightGrams: number;
  centerDiamondCarats: number;
  sideDiamondCarats: number;
  sideDiamondQuantity: number;
  estimatedPrice: number;
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
    confidence: string | null;
    notes: string | null;
    imageDataUrl: string | null;
    sourceImageStorageKey: string | null;
    sourceImageMimeType: string | null;
  } | null;
};

export type QuoteHistoryFilter = "all" | "draft" | "sent" | "ordered" | "expired";

export type QuoteHistoryRow = {
  id: string;
  quoteNumber: string;
  customerName: string | null;
  metalType: string;
  estimatedPrice: number;
  createdAt: Date;
  pdfStoredAt: Date | null;
  thumbnailUrl: string | null;
  status: Exclude<QuoteHistoryFilter, "all">;
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

export function getQuotePublicUrl(quoteId: string) {
  return `/q/${quoteId}`;
}

export async function createQuote(
  input: CreateQuoteInput
): Promise<AppResult<Quote>> {
  const analysis =
    input.analysisId === undefined
      ? null
      : await prisma.aiAnalysis.findFirst({
          where: { id: input.analysisId, companyId: input.companyId }
        });

  if (input.analysisId && !analysis) {
    return { error: NotFoundError("Selected estimate") };
  }

  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const quote = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const quoteNumber = await allocateQuoteNumber(tx, input.companyId);

        return tx.quote.create({
          data: {
            companyId: input.companyId,
            quoteNumber,
            analysisId: analysis?.id,
            customerName: input.customerName || null,
            metalType: input.metalType,
            metalWeightGrams: input.metalWeightGrams,
            centerDiamondCarats: input.centerDiamondCarats,
            sideDiamondCarats: input.sideDiamondCarats,
            sideDiamondQuantity: input.sideDiamondQuantity,
            estimatedPrice: input.estimatedPrice
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
  const quote = await prisma.quote.findFirst({
    where: {
      id: params.quoteId,
      companyId: params.companyId
    },
    include: {
      company: {
        select: {
          name: true
        }
      },
      analysis: {
        select: {
          jewelryType: true,
          centerShape: true,
          confidence: true,
          notes: true,
          imageDataUrl: true,
          sourceImageStorageKey: true,
          sourceImageMimeType: true
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
  const pageSize = params.pageSize ?? 20;
  const query = (params.query ?? "").trim();
  const status = params.status ?? "all";
  const page = Math.max(1, params.page ?? 1);

  const quotes = await prisma.quote.findMany({
    where: { companyId: params.companyId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      quoteNumber: true,
      customerName: true,
      metalType: true,
      estimatedPrice: true,
      createdAt: true,
      pdfStoredAt: true,
      analysis: {
        select: {
          imageDataUrl: true
        }
      },
      order: {
        select: {
          id: true
        }
      }
    }
  });

  const normalizedQuery = query.toLowerCase();
  const filtered = quotes.filter((quote) => {
    const quoteStatus = deriveQuoteStatus(quote);
    const matchesStatus = status === "all" || quoteStatus === status;
    if (!matchesStatus) return false;

    if (!normalizedQuery) return true;

    const haystack = [
      quote.quoteNumber,
      quote.customerName ?? "",
      quote.metalType,
      quote.estimatedPrice.toString()
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });

  const counts = filtered.reduce(
    (acc, quote) => {
      const quoteStatus = deriveQuoteStatus(quote);
      acc[quoteStatus] += 1;
      return acc;
    },
    { draft: 0, sent: 0, ordered: 0, expired: 0 }
  );

  const totalQuotes = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalQuotes / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageQuotes = filtered.slice(start, start + pageSize).map((quote) => ({
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    customerName: quote.customerName,
    metalType: quote.metalType,
    estimatedPrice: Number(quote.estimatedPrice),
    createdAt: quote.createdAt,
    pdfStoredAt: quote.pdfStoredAt,
    thumbnailUrl: quote.analysis?.imageDataUrl ?? null,
    status: deriveQuoteStatus(quote)
  }));

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

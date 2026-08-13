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
      }
    }
  });

  if (!quote) {
    return { error: NotFoundError("Quote") };
  }

  return { data: quote };
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

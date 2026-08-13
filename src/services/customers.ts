import { prisma } from "@/lib/prisma";
import { deriveQuoteStatus } from "@/src/services/quotes";

export type CustomerDirectoryRow = {
  name: string;
  quoteCount: number;
  totalQuotedValue: number;
  latestQuoteNumber: string;
  latestQuoteAt: Date;
  latestStatus: ReturnType<typeof deriveQuoteStatus>;
  named: boolean;
};

export async function getCustomerDirectory(companyId: string) {
  const quotes = await prisma.quote.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    select: {
      quoteNumber: true,
      customerName: true,
      estimatedPrice: true,
      createdAt: true,
      pdfStoredAt: true,
      order: {
        select: {
          id: true
        }
      }
    }
  });

  const map = new Map<string, CustomerDirectoryRow>();
  let unnamedQuoteCount = 0;
  let unnamedTotal = 0;

  for (const quote of quotes) {
    const status = deriveQuoteStatus(quote);
    const name = quote.customerName?.trim() || "";
    if (!name) {
      unnamedQuoteCount += 1;
      unnamedTotal += Number(quote.estimatedPrice);
      continue;
    }

    const key = name.toLowerCase();
    const existing = map.get(key);
    const totalQuotedValue = (existing?.totalQuotedValue ?? 0) + Number(quote.estimatedPrice);
    const row: CustomerDirectoryRow = {
      name,
      quoteCount: (existing?.quoteCount ?? 0) + 1,
      totalQuotedValue,
      latestQuoteNumber: existing?.latestQuoteAt && existing.latestQuoteAt > quote.createdAt ? existing.latestQuoteNumber : quote.quoteNumber,
      latestQuoteAt: existing?.latestQuoteAt && existing.latestQuoteAt > quote.createdAt ? existing.latestQuoteAt : quote.createdAt,
      latestStatus: existing?.latestQuoteAt && existing.latestQuoteAt > quote.createdAt ? existing.latestStatus : status,
      named: true
    };

    map.set(key, row);
  }

  const customers = Array.from(map.values()).sort((a, b) => {
    if (b.quoteCount !== a.quoteCount) return b.quoteCount - a.quoteCount;
    return b.latestQuoteAt.getTime() - a.latestQuoteAt.getTime();
  });

  const unnamed = unnamedQuoteCount
    ? ({
        name: "Unassigned",
        quoteCount: unnamedQuoteCount,
        totalQuotedValue: unnamedTotal,
        latestQuoteNumber: quotes.find((quote) => !quote.customerName?.trim())?.quoteNumber ?? "Unassigned",
        latestQuoteAt: quotes.find((quote) => !quote.customerName?.trim())?.createdAt ?? new Date(),
        latestStatus: deriveQuoteStatus(
          quotes.find((quote) => !quote.customerName?.trim()) ?? {
            createdAt: new Date(),
            pdfStoredAt: null,
            order: null
          }
        ),
        named: false
      } as CustomerDirectoryRow)
    : null;

  return {
    customers,
    unnamed,
    totalCustomers: customers.length,
    totalQuotes: quotes.length,
    totalValue: quotes.reduce((sum, quote) => sum + Number(quote.estimatedPrice), 0),
    namedQuotes: quotes.length - unnamedQuoteCount
  };
}

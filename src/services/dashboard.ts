import { prisma } from "@/lib/prisma";
import { getUsageSummary } from "@/src/services/usage";
import { deriveQuoteStatus, type QuoteHistoryRow } from "@/src/services/quotes";
import { getOrdersOverview } from "@/src/services/orders";

export type DashboardActivityPoint = {
  date: Date;
  label: string;
  count: number;
};

export type DashboardQuoteRow = QuoteHistoryRow;

export type DashboardData = {
  usage: {
    used: number;
    reserved: number;
    limit: number;
    periodStart: Date;
    periodEnd: Date;
    planName: string;
  } | null;
  quotesThisMonth: number;
  totalQuotes: number;
  quotesSentThisMonth: number;
  pendingOrders: number;
  quoteActivity: DashboardActivityPoint[];
  recentQuotes: DashboardQuoteRow[];
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    itemName: string;
    status: "SUBMITTED" | "IN_REVIEW" | "IN_PRODUCTION" | "COMPLETED" | "CANCELED";
    submittedAt: Date;
    updatedAt: Date;
    quoteNumber: string;
  }>;
  quoteStatusCounts: Record<"draft" | "sent" | "ordered" | "expired", number>;
};

function startOfMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function getDashboardData(companyId: string): Promise<DashboardData> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const dayStart = startOfDay(now);
  const quoteWindowStart = new Date(dayStart);
  quoteWindowStart.setUTCDate(quoteWindowStart.getUTCDate() - 29);

  const [usageResult, quotes] = await Promise.all([
    getUsageSummary(companyId),
    prisma.quote.findMany({
      where: { companyId },
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
    })
  ]);
  const ordersOverview = await getOrdersOverview(companyId);

  const usage = "data" in usageResult ? usageResult.data : null;
  const totalQuotes = quotes.length;
  const quotesThisMonth = quotes.filter((quote) => quote.createdAt >= monthStart).length;
  const quotesSentThisMonth = quotes.filter(
    (quote) => quote.pdfStoredAt !== null && quote.pdfStoredAt >= monthStart
  ).length;
  const statusCounts = quotes.reduce(
    (acc, quote) => {
      const status = deriveQuoteStatus(quote);
      acc[status] += 1;
      return acc;
    },
    { draft: 0, sent: 0, ordered: 0, expired: 0 }
  );

  const activityByDate = new Map<string, number>();
  for (const quote of quotes) {
    if (quote.createdAt < quoteWindowStart) continue;
    const key = toDateKey(quote.createdAt);
    activityByDate.set(key, (activityByDate.get(key) ?? 0) + 1);
  }

  const quoteActivity: DashboardActivityPoint[] = [];
  for (let offset = 29; offset >= 0; offset -= 1) {
    const date = new Date(dayStart);
    date.setUTCDate(date.getUTCDate() - offset);
    const key = toDateKey(date);
    quoteActivity.push({
      date,
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count: activityByDate.get(key) ?? 0
    });
  }

  const recentQuotes = quotes.slice(0, 5).map((quote) => ({
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
    usage,
    quotesThisMonth,
    totalQuotes,
    quotesSentThisMonth,
    pendingOrders: ordersOverview.counts.SUBMITTED + ordersOverview.counts.IN_REVIEW + ordersOverview.counts.IN_PRODUCTION,
    quoteActivity,
    recentQuotes,
    recentOrders: ordersOverview.recentOrders,
    quoteStatusCounts: statusCounts
  };
}

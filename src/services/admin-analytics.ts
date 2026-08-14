import { prisma } from "@/lib/prisma";

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toDayKey(date: Date) {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

function buildSeries<T extends { createdAt: Date }>(rows: T[], days: number) {
  const series = new Map<string, number>();
  const now = new Date();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset));
    series.set(toDayKey(date), 0);
  }

  for (const row of rows) {
    const key = toDayKey(row.createdAt);
    if (series.has(key)) {
      series.set(key, (series.get(key) ?? 0) + 1);
    }
  }

  return [...series.entries()].map(([day, value]) => ({ day, value }));
}

export async function getAdminAnalytics() {
  const [companies, quotes, orders, analyses, subscriptions, auditLogs] = await Promise.all([
    prisma.company.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        _count: {
          select: { quotes: true, orders: true, memberships: true, analyses: true }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.quote.findMany({
      select: { createdAt: true, estimatedPrice: true, companyId: true },
      orderBy: { createdAt: "desc" },
      take: 500
    }),
    prisma.order.findMany({
      select: { createdAt: true, status: true, companyId: true },
      orderBy: { createdAt: "desc" },
      take: 500
    }),
    prisma.aiAnalysis.findMany({
      select: { createdAt: true, status: true, companyId: true, moderationFlagged: true },
      orderBy: { createdAt: "desc" },
      take: 500
    }),
    prisma.subscription.findMany({
      select: { status: true, companyId: true, trialEndsAt: true, currentPeriodEnd: true }
    }),
    prisma.auditLog.findMany({
      select: { createdAt: true, action: true, companyId: true },
      orderBy: { createdAt: "desc" },
      take: 500
    })
  ]);

  const completedOrders = orders.filter((order) => order.status === "COMPLETED");
  const analysisFailures = analyses.filter((analysis) => analysis.status === "FAILED").length;
  const moderationFlags = analyses.filter((analysis) => analysis.moderationFlagged).length;
  const totalSubscriptionCount = subscriptions.length;

  const topCompanies = companies
    .map((company) => {
      const companyQuotes = quotes.filter((quote) => quote.companyId === company.id);
      const companyOrders = orders.filter((order) => order.companyId === company.id);
      return {
        ...company,
        quoteCount: companyQuotes.length,
        orderCount: companyOrders.length,
        completedOrders: companyOrders.filter((order) => order.status === "COMPLETED").length
      };
    })
    .sort((a, b) => b.quoteCount - a.quoteCount)
    .slice(0, 5);

  return {
    overview: {
      tenants: companies.length,
      subscriptions: totalSubscriptionCount,
      quotes: quotes.length,
      orders: orders.length,
      completedOrders: completedOrders.length,
      analyses: analyses.length,
      analysisFailures,
      moderationFlags
    },
    series: {
      quotes: buildSeries(quotes, 14),
      orders: buildSeries(orders, 14),
      analyses: buildSeries(analyses, 14),
      auditLogs: buildSeries(auditLogs, 14)
    },
    topCompanies,
    subscriptionsByStatus: subscriptions.reduce<Record<string, number>>((acc, subscription) => {
      acc[subscription.status] = (acc[subscription.status] ?? 0) + 1;
      return acc;
    }, {})
  };
}

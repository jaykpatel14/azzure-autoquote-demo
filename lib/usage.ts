import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canReserveUsage } from "@/lib/usage-policy";
import { getCompanyPlanFeatures } from "@/src/stripe/plans";

export class UsageLimitError extends Error {
  constructor(message = "You have reached your monthly estimate limit. Upgrade your plan to increase your limit.") {
    super(message);
    this.name = "UsageLimitError";
  }
}

type UsageRow = {
  id: string;
  limit: number;
  used: number;
  reserved: number;
};

export async function reserveMonthlyUsage(companyId: string) {
  const now = new Date();
  const { company, features } = await getCompanyPlanFeatures(companyId);
  const subscription = company.subscription;
  const isTrial = subscription?.status === "TRIALING";
  const permitsOverage = company.subscription?.status !== "TRIALING" && features.overageEnabled;

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1. If company is on trial, enforce trial quote cap
    if (isTrial) {
      const currentSub = await tx.subscription.findUnique({
        where: { companyId },
        select: { trialQuotesUsed: true, trialQuoteCap: true, trialEndsAt: true }
      });
      if (currentSub?.trialEndsAt && currentSub.trialEndsAt < now) {
        throw new UsageLimitError("Your 14-day trial period has ended. Please choose a paid plan to continue creating quotes.");
      }
      if (currentSub && currentSub.trialQuotesUsed >= currentSub.trialQuoteCap) {
        throw new UsageLimitError(`You have used all ${currentSub.trialQuoteCap} trial estimates. Please upgrade to a paid plan to continue.`);
      }
    }

    // 2. Fetch and lock current usage period
    const [usage] = await tx.$queryRaw<UsageRow[]>`
      SELECT id, "limit", used, reserved
      FROM "UsagePeriod"
      WHERE "companyId" = ${companyId}
        AND "periodStart" <= ${now}
        AND "periodEnd" > ${now}
      ORDER BY "periodStart" DESC
      LIMIT 1
      FOR UPDATE
    `;

    let activeUsage = usage;
    if (!activeUsage) {
      const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      const monthlyLimit = isTrial ? 40 : Number.isFinite(features.quotesPerMonth) ? features.quotesPerMonth : 2500;

      const created = await tx.usagePeriod.upsert({
        where: {
          companyId_periodStart_periodEnd: {
            companyId,
            periodStart,
            periodEnd
          }
        },
        create: {
          companyId,
          periodStart,
          periodEnd,
          limit: monthlyLimit,
          used: 0,
          reserved: 0
        },
        update: {}
      });

      activeUsage = {
        id: created.id,
        limit: created.limit,
        used: created.used,
        reserved: created.reserved
      };
    }

    if (!canReserveUsage(activeUsage) && !permitsOverage) {
      const planName = features.quotesPerMonth <= 100 ? "Starter" : "your current";
      throw new UsageLimitError(`Monthly limit of ${activeUsage.limit} estimates reached for ${planName} plan. Upgrade to a higher plan or enable overage.`);
    }

    await tx.usagePeriod.update({
      where: { id: activeUsage.id },
      data: { reserved: { increment: 1 } }
    });

    return { usagePeriodId: activeUsage.id, isOverage: !canReserveUsage(activeUsage) };
  });
}

export async function consumeMonthlyUsage(usagePeriodId: string, companyId?: string) {
  const result = await prisma.usagePeriod.updateMany({
    where: { id: usagePeriodId, reserved: { gt: 0 } },
    data: {
      reserved: { decrement: 1 },
      used: { increment: 1 }
    }
  });

  if (result.count !== 1) {
    throw new Error("Usage reservation could not be consumed.");
  }

  // Increment trialQuotesUsed if on trial
  if (companyId) {
    await prisma.subscription.updateMany({
      where: { companyId, status: "TRIALING" },
      data: { trialQuotesUsed: { increment: 1 } }
    }).catch(() => {});
  }
}

export async function releaseMonthlyUsage(usagePeriodId: string) {
  await prisma.usagePeriod.updateMany({
    where: { id: usagePeriodId, reserved: { gt: 0 } },
    data: { reserved: { decrement: 1 } }
  });
}

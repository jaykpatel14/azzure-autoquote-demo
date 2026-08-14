import type { UsagePeriod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canReserveUsage } from "@/lib/usage-policy";
import {
  NotFoundError,
  type AppError,
  type AppResult,
  UsageLimitError
} from "@/src/lib/errors";

type UsageRow = {
  id: string;
  limit: number;
  used: number;
  reserved: number;
};

function isActivePeriod(period: Pick<UsagePeriod, "periodStart" | "periodEnd">, now = new Date()) {
  return period.periodStart <= now && period.periodEnd > now;
}

export async function canCreateQuote(
  companyId: string
): Promise<{ allowed: true } | { allowed: false; error: AppError }> {
  const period = await prisma.usagePeriod.findFirst({
    where: {
      companyId,
      periodStart: { lte: new Date() },
      periodEnd: { gt: new Date() }
    },
    orderBy: { periodStart: "desc" }
  });

  if (!period) {
    return { allowed: false, error: UsageLimitError() };
  }

  if (!canReserveUsage(period)) {
    return { allowed: false, error: UsageLimitError() };
  }

  return { allowed: true };
}

export async function incrementUsage(companyId: string): Promise<AppResult<UsagePeriod>> {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
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

    if (!usage) {
      return { error: NotFoundError("Usage period") };
    }

    if (!canReserveUsage(usage)) {
      return { error: UsageLimitError() };
    }

    await tx.usagePeriod.update({
      where: { id: usage.id },
      data: { used: { increment: 1 } }
    });

    const updated = await tx.usagePeriod.findUnique({
      where: { id: usage.id }
    });

    if (!updated) {
      return { error: NotFoundError("Usage period") };
    }

    return { data: updated };
  });
}

export async function getUsageSummary(companyId: string): Promise<
  AppResult<{
    used: number;
    reserved: number;
    limit: number;
    periodStart: Date;
    periodEnd: Date;
    planName: string;
  }>
> {
  const now = new Date();
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      subscription: {
        select: {
          plan: {
            select: { name: true }
          }
        }
      },
      usagePeriods: {
        where: {
          periodStart: { lte: now },
          periodEnd: { gt: now }
        },
        orderBy: { periodStart: "desc" },
        take: 1,
        select: {
          used: true,
          reserved: true,
          limit: true,
          periodStart: true,
          periodEnd: true
        }
      }
    }
  });

  if (!company || company.usagePeriods.length === 0) {
    return { error: NotFoundError("Usage period") };
  }

  const period = company.usagePeriods[0];
  return {
    data: {
      used: period.used,
      reserved: period.reserved,
      limit: period.limit,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      planName: company.subscription?.plan.name ?? "Starter"
    }
  };
}

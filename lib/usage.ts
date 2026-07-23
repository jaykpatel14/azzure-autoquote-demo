import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canReserveUsage } from "@/lib/usage-policy";

export class UsageLimitError extends Error {
  constructor(message = "Monthly estimate limit reached.") {
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

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
      throw new Error("No active usage period found for this company.");
    }

    if (!canReserveUsage(usage)) {
      throw new UsageLimitError();
    }

    await tx.usagePeriod.update({
      where: { id: usage.id },
      data: { reserved: { increment: 1 } }
    });

    return { usagePeriodId: usage.id };
  });
}

export async function consumeMonthlyUsage(usagePeriodId: string) {
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
}

export async function releaseMonthlyUsage(usagePeriodId: string) {
  await prisma.usagePeriod.updateMany({
    where: { id: usagePeriodId, reserved: { gt: 0 } },
    data: { reserved: { decrement: 1 } }
  });
}

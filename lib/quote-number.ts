import type { Prisma } from "@prisma/client";

export async function allocateQuoteNumber(
  tx: Prisma.TransactionClient,
  companyId: string
): Promise<string> {
  const company = await tx.company.update({
    where: { id: companyId },
    data: { quoteSequence: { increment: 1 } },
    select: { quoteSequence: true }
  });

  return `AQ-${String(company.quoteSequence).padStart(6, "0")}`;
}

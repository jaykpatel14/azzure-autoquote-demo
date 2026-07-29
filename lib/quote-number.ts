import type { Prisma } from "@prisma/client";

export async function allocateQuoteNumber(
  tx: Prisma.TransactionClient,
  companyId: string
): Promise<string> {
  const [row] = await tx.$queryRaw<Array<{ maxSequence: number | null }>>`
    SELECT COALESCE(
      MAX(
        CASE
          WHEN "quoteNumber" ~ '^AQ-[0-9]+$' THEN CAST(SUBSTRING("quoteNumber" FROM '[0-9]+$') AS INTEGER)
          ELSE 0
        END
      ),
      0
    ) AS "maxSequence"
    FROM "Quote"
    WHERE "companyId" = ${companyId}
  `;

  const maxSequence = row?.maxSequence ?? 0;
  const [company] = await tx.$queryRaw<Array<{ quoteSequence: number }>>`
    UPDATE "Company"
    SET "quoteSequence" = GREATEST("quoteSequence", ${maxSequence}) + 1
    WHERE id = ${companyId}
    RETURNING "quoteSequence"
  `;

  return `AQ-${String(company.quoteSequence).padStart(6, "0")}`;
}

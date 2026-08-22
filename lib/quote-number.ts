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
  const [company] = await tx.$queryRaw<Array<{ quoteSequence: number, quotePrefix: string | null }>>`
    UPDATE "Company"
    SET "quoteSequence" = GREATEST("quoteSequence", ${maxSequence}) + 1
    WHERE id = ${companyId}
    RETURNING "quoteSequence", "quotePrefix"
  `;

  const prefix = company.quotePrefix || "AQ";
  return `${prefix}-${String(company.quoteSequence).padStart(6, "0")}`;
}


export async function generateUniqueQuotePrefix(tx: any, companyName: string): Promise<string> {
  const words = companyName.replace(/[^a-zA-Z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  let basePrefix = "AQX";
  if (words.length >= 3) {
    basePrefix = (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
  } else if (words.length === 2) {
    basePrefix = (words[0][0] + words[0][1] + words[1][0]).toUpperCase();
  } else if (words.length === 1 && words[0].length >= 3) {
    basePrefix = words[0].substring(0, 3).toUpperCase();
  } else if (words.length > 0) {
    basePrefix = words[0].substring(0, 3).toUpperCase().padEnd(3, "X");
  }

  let prefix = basePrefix;
  let isUnique = false;
  let attempt = 0;
  while (!isUnique) {
    const existing = await tx.company.findUnique({ where: { quotePrefix: prefix } });
    if (!existing) {
      isUnique = true;
    } else {
      attempt++;
      prefix = basePrefix.substring(0, 2) + attempt;
    }
  }
  return prefix;
}
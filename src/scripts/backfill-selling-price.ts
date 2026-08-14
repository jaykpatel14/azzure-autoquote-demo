import { prisma } from "@/lib/prisma";
import { calculateMissingSellingPrice } from "@/src/services/backfill-selling-price";

async function backfillSellingPrices() {
  const where = {
    company: { accountStatus: "APPROVED" as const },
    makingPrice: { not: null },
    estimatedSellingPrice: null,
    pricingTierSnapshot: { not: null }
  };

  const candidates = await prisma.quote.findMany({
    where,
    select: {
      id: true,
      makingPrice: true,
      pricingTierSnapshot: true
    }
  });

  console.log(`Backfilling ${candidates.length} quote(s)...`);

  const updatedCount = await prisma.$transaction(async (tx) => {
    let updated = 0;
    for (const quote of candidates) {
      if (!quote.makingPrice || !quote.pricingTierSnapshot) continue;
      const estimatedSellingPrice = calculateMissingSellingPrice({
        makingPrice: Number(quote.makingPrice),
        pricingTier: quote.pricingTierSnapshot,
        estimatedSellingPrice: null
      });
      if (estimatedSellingPrice === null) continue;
      await tx.quote.update({
        where: { id: quote.id },
        data: { estimatedSellingPrice }
      });
      updated += 1;
    }
    return updated;
  });

  const remaining = await prisma.quote.count({ where });
  if (updatedCount !== candidates.length || remaining !== 0) {
    throw new Error(
      `Backfill verification failed: expected ${candidates.length}, updated ${updatedCount}, remaining ${remaining}.`
    );
  }

  console.log(`Done. Updated ${updatedCount} quote(s); ${remaining} remain.`);
}

backfillSellingPrices()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

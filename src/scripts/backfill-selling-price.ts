import { prisma } from "@/lib/prisma";
import { calculateMissingSellingPrice, recoverLegacyQuotePricing } from "@/src/services/backfill-selling-price";
import { TIER_DIVISORS } from "@/src/services/pricing";

async function backfillSellingPrices() {
  const where = {
    company: { accountStatus: "APPROVED" as const },
    OR: [{ makingPrice: null }, { estimatedSellingPrice: null }, { pricingTierSnapshot: null }, { tierDivisorSnapshot: null }]
  };

  const candidates = await prisma.quote.findMany({
    where,
    select: {
      id: true,
      makingPrice: true,
      estimatedPrice: true,
      estimatedSellingPrice: true,
      pricingTierSnapshot: true,
      tierDivisorSnapshot: true,
      company: { select: { pricingTier: true } }
    }
  });

  console.log(`Backfilling ${candidates.length} quote(s)...`);

  const updatedCount = await prisma.$transaction(async (tx) => {
    let updated = 0;
    for (const quote of candidates) {
      const tier = quote.pricingTierSnapshot ?? quote.company.pricingTier;
      if (!tier) continue;
      const recovered = quote.makingPrice === null
        ? recoverLegacyQuotePricing({ estimatedPrice: Number(quote.estimatedPrice), pricingTier: tier })
        : null;
      const estimatedSellingPrice = quote.makingPrice === null ? null : calculateMissingSellingPrice({
        makingPrice: Number(quote.makingPrice), pricingTier: tier,
        estimatedSellingPrice: quote.estimatedSellingPrice === null ? null : Number(quote.estimatedSellingPrice)
      });
      await tx.quote.update({
        where: { id: quote.id },
        data: recovered ?? {
          pricingTierSnapshot: tier,
          tierDivisorSnapshot: quote.tierDivisorSnapshot ?? TIER_DIVISORS[tier],
          estimatedSellingPrice: estimatedSellingPrice ?? Number(quote.estimatedPrice)
        }
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

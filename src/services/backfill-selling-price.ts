import type { PricingTier } from "@prisma/client";
import { calculateTierPrice, TIER_DIVISORS } from "@/src/services/pricing";

export function calculateMissingSellingPrice(input: {
  makingPrice: number | null;
  pricingTier: PricingTier | null;
  estimatedSellingPrice: number | null;
}) {
  if (input.estimatedSellingPrice !== null || input.makingPrice === null || input.pricingTier === null) {
    return null;
  }
  return calculateTierPrice(input.makingPrice, input.pricingTier).estimatedSellingPrice;
}

export function recoverLegacyQuotePricing(input: { estimatedPrice: number; pricingTier: PricingTier }) {
  const divisor = TIER_DIVISORS[input.pricingTier];
  return { makingPrice: Math.round((input.estimatedPrice * divisor / 2) * 100) / 100, pricingTierSnapshot: input.pricingTier, tierDivisorSnapshot: divisor, estimatedSellingPrice: input.estimatedPrice };
}

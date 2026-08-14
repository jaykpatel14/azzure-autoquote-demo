import type { PricingTier } from "@prisma/client";
import { calculateTierPrice } from "@/src/services/pricing";

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

import type { PricingTier } from "@prisma/client";

export const TIER_DIVISORS: Record<PricingTier, number> = {
  TIER_1: 0.6,
  TIER_2: 0.7,
  TIER_3: 0.8
};

const TIER_LABELS: Record<PricingTier, string> = {
  TIER_1: "Tier 1 - Premium",
  TIER_2: "Tier 2 - Standard",
  TIER_3: "Tier 3 - Basic"
};

export type TierPriceResult = {
  makingPrice: number;
  tier: PricingTier;
  divisor: number;
  estimatedSellingPrice: number;
  formattedBreakdown: {
    makingPrice: string;
    estimatedSellingPrice: string;
    tierLabel: string;
  };
};

function formatCAD(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD"
  }).format(amount);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateTierPrice(makingPrice: number, tier: PricingTier): TierPriceResult {
  if (makingPrice <= 0) {
    throw new Error("Making price must be greater than zero.");
  }

  const divisor = TIER_DIVISORS[tier];
  const estimatedSellingPrice = roundMoney((makingPrice / divisor) * 2);

  return {
    makingPrice: roundMoney(makingPrice),
    tier,
    divisor,
    estimatedSellingPrice,
    formattedBreakdown: {
      makingPrice: formatCAD(makingPrice),
      estimatedSellingPrice: formatCAD(estimatedSellingPrice),
      tierLabel: TIER_LABELS[tier]
    }
  };
}

export function getPricingTierLabel(tier: PricingTier | null | undefined) {
  return tier ? TIER_LABELS[tier] : null;
}

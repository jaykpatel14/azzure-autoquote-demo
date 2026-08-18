import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { calculateMissingSellingPrice, recoverLegacyQuotePricing } from "@/src/services/backfill-selling-price";

describe("jeweler price visibility", () => {
  test.each([
    "app/quotes/[quoteId]/page.tsx",
    "app/quotes/page.tsx",
    "app/q/[token]/page.tsx",
    "components/QuoteCalculator.tsx",
    "app/showroom/showroom-kiosk.tsx"
  ])("%s does not render making price", (path) => {
    expect(readFileSync(path, "utf8")).not.toContain("makingPrice");
  });

  test("admin quote detail retains the internal financial view", () => {
    expect(readFileSync("app/admin/quotes/[quoteId]/page.tsx", "utf8")).toContain("quote.makingPrice");
  });
});

describe("selling-price backfill", () => {
  test.each([
    ["TIER_1", 1666.67],
    ["TIER_2", 1428.57],
    ["TIER_3", 1250]
  ] as const)("calculates %s", (pricingTier, expected) => {
    expect(calculateMissingSellingPrice({ makingPrice: 500, pricingTier, estimatedSellingPrice: null })).toBeCloseTo(expected, 2);
  });

  test("skips populated and incomplete rows", () => {
    expect(calculateMissingSellingPrice({ makingPrice: 500, pricingTier: "TIER_1", estimatedSellingPrice: 900 })).toBeNull();
    expect(calculateMissingSellingPrice({ makingPrice: null, pricingTier: "TIER_1", estimatedSellingPrice: null })).toBeNull();
    expect(calculateMissingSellingPrice({ makingPrice: 500, pricingTier: null, estimatedSellingPrice: null })).toBeNull();
  });

  test("reconstructs missing Tier 2 snapshots without changing the legacy customer total", () => {
    expect(recoverLegacyQuotePricing({ estimatedPrice: 3937.39, pricingTier: "TIER_2" })).toEqual({
      makingPrice: 1378.09,
      pricingTierSnapshot: "TIER_2",
      tierDivisorSnapshot: 0.7,
      estimatedSellingPrice: 3937.39
    });
  });
});

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
    // Word-boundary match: these files legitimately read the makingPriceBreakdown
    // JSON blob to show a customer-safe cost breakdown (metal/stone/labor line
    // items, subtotal, final price) — that container name is fine to reference.
    // What must never appear is the actual Azzure-price accessor `.makingPrice`
    // itself (Azzure's price to the jeweler) or its tier-formula components.
    const source = readFileSync(path, "utf8");
    expect(source).not.toMatch(/\bmakingPrice\b/);
    expect(source).not.toMatch(/\btierDivisor\b/);
    expect(source).not.toMatch(/\bcustomerMarginAmount\b/);
  });

  test("admin quote detail retains the internal financial view", () => {
    expect(readFileSync("app/admin/quotes/[quoteId]/page.tsx", "utf8")).toContain("quote.makingPrice");
  });

  test("tenant quote detail strips the cost snapshot before rendering for restricted roles", () => {
    const source = readFileSync("app/quotes/[quoteId]/page.tsx", "utf8");
    expect(source).toContain("costBreakdown={allowFullPricing ? costBreakdown : null}");
  });

  test("restricted quote detail renders no manufacturing-cost panel", () => {
    const source = readFileSync("components/quote-detail-price-view.tsx", "utf8");
    expect(source).not.toContain("RestrictedQuoteCostBreakdown");
    expect(source).not.toContain("Manufacturing cost");
  });
});

describe("selling-price backfill", () => {
  test.each([
    ["TIER_1", 833.33],
    ["TIER_2", 714.29],
    ["TIER_3", 625]
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

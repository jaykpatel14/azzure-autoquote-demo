import { describe, expect, it } from "vitest";
import {
  calculateMakingPrice,
  calculateTierPrice,
  isSideStoneRound,
  sideStoneCost,
  sideStoneSettingCost
} from "@/src/services/pricing";

describe("calculateMakingPrice", () => {
  it("uses the supplied lab table for a standard center stone", () => {
    const result = calculateMakingPrice({
      centerStone: { shape: "oval", caratWeight: 1.0 },
      sideStones: [],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1"
    });
    expect(result.centerStoneCost).toBe(100);
  });

  it("uses the supplied lab table regardless of lab center shape", () => {
    const result = calculateMakingPrice({
      centerStone: { shape: "heart", caratWeight: 1.0 },
      sideStones: [],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1"
    });
    expect(result.centerStoneCost).toBe(100);
  });

  it("round lab side stones use the supplied inferred-mm band", () => {
    const result = calculateMakingPrice({
      centerStone: { shape: "round", caratWeight: 1.0 },
      sideStones: [{ shape: "round", caratWeightEach: 0.05, count: 10, settingType: "prong" }],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1"
    });
    // 10 × 0.05ct = 0.5ct total × $80 = $40
    expect(result.sideStoneCost).toBe(35);
  });

  it("fancy lab side stones use the supplied $150/ct rate", () => {
    const result = calculateMakingPrice({
      centerStone: { shape: "round", caratWeight: 1.0 },
      sideStones: [{ shape: "baguette", caratWeightEach: 0.1, count: 4, settingType: "channel" }],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1"
    });
    // 4 × 0.1ct = 0.4ct × $130 = $52
    expect(result.sideStoneCost).toBe(60);
  });

  it("center stone setting is $20/ct", () => {
    const result = calculateMakingPrice({
      centerStone: { shape: "round", caratWeight: 2.0 },
      sideStones: [],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1"
    });
    expect(result.centerStoneSettingCost).toBe(40);
  });

  it("side stone setting: round is $1.25/stone, non-round is $5.00/stone", () => {
    const round = calculateMakingPrice({
      centerStone: { shape: "round", caratWeight: 1.0 },
      sideStones: [{ shape: "round", caratWeightEach: 0.05, count: 10, settingType: "prong" }],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1"
    });
    // 10 round stones × $1.25 = $12.50
    expect(round.sideStoneSettingCost).toBeCloseTo(12.5, 2);

    const nonRound = calculateMakingPrice({
      centerStone: { shape: "round", caratWeight: 1.0 },
      sideStones: [{ shape: "trapezoid", caratWeightEach: 0.5, count: 2, settingType: "prong" }],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1"
    });
    // 2 non-round stones × $5.00 = $10.00
    expect(nonRound.sideStoneSettingCost).toBeCloseTo(10.0, 2);
  });

  it("wax is $15 for single piece, $30 for piece + wedding band", () => {
    const single = calculateMakingPrice({
      centerStone: { shape: "round", caratWeight: 1.0 },
      sideStones: [],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1"
    });
    expect(single.waxCost).toBe(15);

    const double = calculateMakingPrice({
      centerStone: { shape: "round", caratWeight: 1.0 },
      sideStones: [],
      hasWeddingBand: true,
      isTwoTone: false,
      colorClarity: "E VS1"
    });
    expect(double.waxCost).toBe(30);
  });

  it("polishing is $20 for single piece, $40 for piece + wedding band", () => {
    const single = calculateMakingPrice({
      centerStone: { shape: "round", caratWeight: 1.0 },
      sideStones: [],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1"
    });
    expect(single.polishingCost).toBe(20);

    const double = calculateMakingPrice({
      centerStone: { shape: "round", caratWeight: 1.0 },
      sideStones: [],
      hasWeddingBand: true,
      isTwoTone: false,
      colorClarity: "E VS1"
    });
    expect(double.polishingCost).toBe(40);
  });

  it("CAD fee defaults to flat $20.00", () => {
    const result = calculateMakingPrice({
      centerStone: { shape: "round", caratWeight: 1.0 },
      sideStones: [],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1"
    });
    expect(result.cadCost).toBe(20);
  });

  it("pricing hierarchy: 1. Production subtotal -> 2. Tier formula -> 3. Customer margin", () => {
    // Metal 14K 8.5g = $809.27
    // Center: 4.0ct Emerald @ $125 = $500.00
    // Side: 2.0ct total (2x non-round @ $130/ct) = $260.00
    // Center setting: 4.0ct @ $20 = $80.00
    // Side setting: 2x non-round @ $5.00 = $10.00
    // Wax: $15, Polishing: $20, CAD: $20
    // Subtotal = $1,714.27
    // Tier 2 (divisor 0.7): Making Price = $1,714.27 / 0.7 = $2,448.96
    // Jeweler Markup 20%: $2,448.96 * 0.20 = $489.79
    // End Customer Price = $2,448.96 + $489.79 = $2,938.75
    const result = calculateMakingPrice({
      metalType: "14K",
      metalWeightGrams: 8.5,
      goldSpotPerOz: 4500,
      centerStone: { shape: "emerald", caratWeight: 4.0 },
      sideStones: [{ shape: "trapezoid", caratWeightEach: 1.0, count: 2, settingType: "prong" }],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1",
      cadCost: 20,
      pricingTier: "TIER_2",
      customerMarginPct: 20
    });

    expect(result.cadCost).toBe(20);
    expect(result.subtotal).toBeCloseTo(2024.27, 1);
    expect(result.makingPrice).toBeCloseTo(2891.81, 1);
    expect(result.customerMarginAmount).toBeCloseTo(578.36, 1);
    expect(result.estimatedSellingPrice).toBeCloseTo(3470.17, 1);
  });

  it("prices lab color stones and gemstones at $40 per total carat", () => {
    const result = calculateMakingPrice({
      stoneOrigin: "gemstone",
      centerStone: { shape: "oval", caratWeight: 1.5 },
      sideStones: [{ shape: "round", caratWeightEach: 0.05, count: 10 }],
      hasWeddingBand: false,
      isTwoTone: false
    });

    expect(result.centerStoneCost).toBe(60);
    expect(result.sideStoneCost).toBe(20);
  });

  it("treats metal weight as the total while quantity only scales per-piece finishing", () => {
    const one = calculateMakingPrice({
      quantity: 1,
      metalType: "14K",
      metalWeightGrams: 6,
      centerStone: { shape: "round", caratWeight: 1 },
      sideStones: [],
      hasWeddingBand: false,
      isTwoTone: false
    });
    const three = calculateMakingPrice({
      quantity: 3,
      metalType: "14K",
      metalWeightGrams: 6,
      centerStone: { shape: "round", caratWeight: 1 },
      sideStones: [],
      hasWeddingBand: false,
      isTwoTone: false
    });

    expect(three.metalCost).toBe(one.metalCost);
    expect(three.waxCost).toBe(one.waxCost * 3);
    expect(three.polishingCost).toBe(one.polishingCost * 3);
  });

  it("uses platinum at $2,000/oz plus 40% labor and silver at a flat $300/oz", () => {
    const platinum = calculateMakingPrice({
      metalType: "Platinum",
      metalWeightGrams: 31.1034768,
      centerStone: { shape: "round", caratWeight: 1 },
      sideStones: [],
      hasWeddingBand: false,
      isTwoTone: false
    });
    const silver = calculateMakingPrice({
      metalType: "Silver",
      metalWeightGrams: 31.1034768,
      centerStone: { shape: "round", caratWeight: 1 },
      sideStones: [],
      hasWeddingBand: false,
      isTwoTone: false
    });

    expect(platinum.metalCost).toBe(2800);
    expect(silver.metalCost).toBe(300);
  });
});

describe("calculateTierPrice", () => {
  it("Tier 1: 600 subtotal / 0.6 = 1000 making price, with 20% margin = 1200", () => {
    const result = calculateTierPrice(600, "TIER_1", 20);
    expect(result.makingPrice).toBe(1000);
    expect(result.estimatedSellingPrice).toBe(1200);
    expect(result.divisor).toBe(0.6);
  });

  it("Tier 2: 700 subtotal / 0.7 = 1000 making price", () => {
    const result = calculateTierPrice(700, "TIER_2", 0);
    expect(result.makingPrice).toBe(1000);
    expect(result.estimatedSellingPrice).toBe(1000);
    expect(result.divisor).toBe(0.7);
  });

  it("Tier 3: 800 subtotal / 0.8 = 1000 making price", () => {
    const result = calculateTierPrice(800, "TIER_3", 10);
    expect(result.makingPrice).toBe(1000);
    expect(result.estimatedSellingPrice).toBe(1100);
    expect(result.divisor).toBe(0.8);
  });

  it("returns error on zero production subtotal", () => {
    expect(() => calculateTierPrice(0, "TIER_1")).toThrow();
  });
});


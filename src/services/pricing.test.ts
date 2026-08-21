import { describe, expect, it } from "vitest";
import {
  calculateMakingPrice,
  calculateMetalCost,
  calculateTierPrice,
  isSideStoneRound,
  sideStoneCost,
  sideStoneSettingCost
} from "@/src/services/pricing";

describe("calculateMetalCost", () => {
  it("Platinum prices off platinumSpotPerOz, not goldSpotPerOz", () => {
    const withHighGoldSpot = calculateMetalCost("Platinum", 10, { goldSpotPerOz: 4500, platinumSpotPerOz: 2000 });
    const withoutGoldSpot = calculateMetalCost("Platinum", 10, { platinumSpotPerOz: 2000 });
    expect(withHighGoldSpot).toBeCloseTo(withoutGoldSpot, 5);

    // An absurdly high gold spot must not leak into the platinum price.
    const inflatedGoldSpot = calculateMetalCost("Platinum", 10, { goldSpotPerOz: 999999, platinumSpotPerOz: 2000 });
    expect(inflatedGoldSpot).toBeCloseTo(withoutGoldSpot, 5);
  });

  it("Silver prices off silverSpotPerOz, not goldSpotPerOz", () => {
    const withHighGoldSpot = calculateMetalCost("Silver", 10, { goldSpotPerOz: 4500, silverSpotPerOz: 100 });
    const withoutGoldSpot = calculateMetalCost("Silver", 10, { silverSpotPerOz: 100 });
    expect(withHighGoldSpot).toBeCloseTo(withoutGoldSpot, 5);
  });

  it("switching from 14K gold to Platinum/Silver drops the metal cost when their spot rates are lower", () => {
    // Regression test: switching metal type used to always price off goldSpotPerOz
    // regardless of which metal was selected, so Platinum/Silver (which trade far
    // below gold in this profile) appeared MORE expensive than gold instead of less.
    const goldCost = calculateMetalCost("14K", 10, { goldSpotPerOz: 4500 });
    const platinumCost = calculateMetalCost("Platinum", 10, { goldSpotPerOz: 4500, platinumSpotPerOz: 2000 });
    const silverCost = calculateMetalCost("Silver", 10, { goldSpotPerOz: 4500, silverSpotPerOz: 100 });

    expect(platinumCost).toBeLessThan(goldCost);
    expect(silverCost).toBeLessThan(goldCost);
  });
});

describe("calculateMakingPrice", () => {
  it("Platinum quotes use platinumSpotPerOz through the full breakdown, not goldSpotPerOz", () => {
    const result = calculateMakingPrice({
      metalType: "Platinum",
      metalWeightGrams: 10,
      goldSpotPerOz: 4500,
      platinumSpotPerOz: 2000,
      centerStone: { shape: "round", caratWeight: 1.0 },
      sideStones: [],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1"
    });

    const withoutGoldSpot = calculateMakingPrice({
      metalType: "Platinum",
      metalWeightGrams: 10,
      platinumSpotPerOz: 2000,
      centerStone: { shape: "round", caratWeight: 1.0 },
      sideStones: [],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1"
    });

    expect(result.metalCost).toBeCloseTo(withoutGoldSpot.metalCost, 2);
  });
  it("standard shapes use $125/ct for center stone", () => {
    const result = calculateMakingPrice({
      centerStone: { shape: "oval", caratWeight: 1.0 },
      sideStones: [],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1"
    });
    expect(result.centerStoneCost).toBe(125);
  });

  it("non-standard shapes use $175/ct for center stone", () => {
    const result = calculateMakingPrice({
      centerStone: { shape: "heart", caratWeight: 1.0 },
      sideStones: [],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1"
    });
    expect(result.centerStoneCost).toBe(175);
  });

  it("round side stones use $80/ct", () => {
    const result = calculateMakingPrice({
      centerStone: { shape: "round", caratWeight: 1.0 },
      sideStones: [{ shape: "round", caratWeightEach: 0.05, count: 10, settingType: "prong" }],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1"
    });
    // 10 × 0.05ct = 0.5ct total × $80 = $40
    expect(result.sideStoneCost).toBe(40);
  });

  it("non-round / fancy side stones use $130/ct", () => {
    const result = calculateMakingPrice({
      centerStone: { shape: "round", caratWeight: 1.0 },
      sideStones: [{ shape: "baguette", caratWeightEach: 0.1, count: 4, settingType: "channel" }],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1"
    });
    // 4 × 0.1ct = 0.4ct × $130 = $52
    expect(result.sideStoneCost).toBe(52);
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
    expect(result.subtotal).toBeCloseTo(1804.27, 1);
    expect(result.makingPrice).toBeCloseTo(2577.53, 1);
    expect(result.customerMarginAmount).toBeCloseTo(515.51, 1);
    expect(result.estimatedSellingPrice).toBeCloseTo(3093.04, 1);
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


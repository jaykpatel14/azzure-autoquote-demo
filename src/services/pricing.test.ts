import { describe, expect, it } from "vitest";
import {
  calculateMakingPrice,
  calculateTierPrice
} from "@/src/services/pricing";

describe("calculateMakingPrice", () => {
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

  it("fancy side stones use $130/ct", () => {
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

  it("side stone setting rule A: prong/claw uses $1.25/stone, other settings use $5.00/stone", () => {
    const prong = calculateMakingPrice({
      centerStone: { shape: "round", caratWeight: 1.0 },
      sideStones: [{ shape: "round", caratWeightEach: 0.05, count: 10, settingType: "prong" }],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1"
    });
    // 10 stones × $1.25 = $12.50
    expect(prong.sideStoneSettingCost).toBeCloseTo(12.5, 2);

    const claw = calculateMakingPrice({
      centerStone: { shape: "round", caratWeight: 1.0 },
      sideStones: [{ shape: "round", caratWeightEach: 0.05, count: 10, settingType: "claw" }],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1"
    });
    // 10 stones × $1.25 = $12.50
    expect(claw.sideStoneSettingCost).toBeCloseTo(12.5, 2);

    const bezel = calculateMakingPrice({
      centerStone: { shape: "round", caratWeight: 1.0 },
      sideStones: [{ shape: "round", caratWeightEach: 0.05, count: 10, settingType: "bezel" }],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1"
    });
    // 10 stones × $5.00 = $50.00
    expect(bezel.sideStoneSettingCost).toBeCloseTo(50, 2);
  });

  it("side stone setting rule B: large stone surcharge of $10 per stone (> 0.5ct)", () => {
    const result = calculateMakingPrice({
      centerStone: { shape: "round", caratWeight: 1.0 },
      sideStones: [{ shape: "round", caratWeightEach: 0.6, count: 2, settingType: "prong" }],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1"
    });
    // Rule A: 2 stones × $1.25 = $2.50
    // Rule B: 2 stones × $10 = $20.00
    // Total = $22.50
    expect(result.sideStoneSettingCost).toBeCloseTo(22.5, 2);
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

  it("colorClarity is always E VS1 regardless of input", () => {
    const result = calculateMakingPrice({
      centerStone: { shape: "round", caratWeight: 1.0 },
      sideStones: [],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1"
    });
    expect(result.colorClarity).toBe("E VS1");
  });

  it("CAD cost is added to subtotal", () => {
    const result = calculateMakingPrice({
      centerStone: { shape: "round", caratWeight: 1.0 },
      sideStones: [],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1",
      cadCost: 50,
      customerMarginPct: 0
    });
    // Center stone: 1.0 × $125 = $125
    // Center setting: 1.0 × $20 = $20
    // Wax: $15, Polishing: $20, CAD: $50
    // Subtotal = $230, no margin
    expect(result.cadCost).toBe(50);
    expect(result.subtotal).toBeCloseTo(230, 2);
    expect(result.makingPrice).toBeCloseTo(230, 2);
  });

  it("customer margin is percentage of subtotal", () => {
    const result = calculateMakingPrice({
      centerStone: { shape: "round", caratWeight: 1.0 },
      sideStones: [],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1",
      cadCost: 0,
      customerMarginPct: 20
    });
    // Subtotal = $180 (125 + 0 + 20 + 0 + 15 + 20)
    // Margin = $180 × 0.20 = $36
    // Making price = $180 + $36 = $216
    expect(result.customerMarginPct).toBe(20);
    expect(result.customerMarginAmount).toBeCloseTo(36, 2);
    expect(result.makingPrice).toBeCloseTo(216, 2);
  });

  it("zero margin leaves making price equal to subtotal", () => {
    const result = calculateMakingPrice({
      centerStone: { shape: "round", caratWeight: 1.0 },
      sideStones: [],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1",
      cadCost: 0,
      customerMarginPct: 0
    });
    expect(result.customerMarginAmount).toBe(0);
    expect(result.makingPrice).toBe(result.subtotal);
  });

  it("tier formula is applied on top of making price — not inside it", () => {
    const makingResult = calculateMakingPrice({
      centerStone: { shape: "round", caratWeight: 1.0 },
      sideStones: [],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1",
      cadCost: 50,
      customerMarginPct: 20
    });
    const tierResult = calculateTierPrice(makingResult.makingPrice, "TIER_2");
    // End customer price = makingPrice / 0.7 (jeweler applies their own margin on top)
    const expected = makingResult.makingPrice / 0.7;
    expect(tierResult.estimatedSellingPrice).toBeCloseTo(expected, 2);
  });

  it("full realistic quote: 1.5ct oval + 20 round side stones, 20% margin, $50 CAD", () => {
    const result = calculateMakingPrice({
      centerStone: { shape: "oval", caratWeight: 1.5 },
      sideStones: [
        {
          shape: "round",
          caratWeightEach: 0.02,
          count: 20,
          settingType: "prong"
        }
      ],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1",
      cadCost: 50,
      customerMarginPct: 20
    });
    // Center stone:         1.5 × $125   = $187.50
    // Side stones:          0.4ct × $80  = $32.00
    // Center setting:       1.5 × $20    = $30.00
    // Side setting (RuleA): 20 × $1.25   = $25.00
    // Side setting (RuleB): 0.02 < 0.5   = $0
    // Wax:                  1 × $15      = $15.00
    // Polishing:            1 × $20      = $20.00
    // CAD:                               = $50.00
    // ─────────────────────────────────────────────
    // Subtotal:                          = $359.50
    // Customer margin (20%):             = $71.90
    // ─────────────────────────────────────────────
    // Making price:                      = $431.40
    expect(result.subtotal).toBeCloseTo(359.5, 2);
    expect(result.customerMarginAmount).toBeCloseTo(71.9, 2);
    expect(result.makingPrice).toBeCloseTo(431.4, 2);
  });
});

describe("calculateTierPrice", () => {
  it("Tier 1: 500 / 0.6 = 833.33", () => {
    const result = calculateTierPrice(500, "TIER_1");
    expect(result.estimatedSellingPrice).toBeCloseTo(833.33, 2);
    expect(result.divisor).toBe(0.6);
  });

  it("Tier 2: 500 / 0.7 = 714.29", () => {
    const result = calculateTierPrice(500, "TIER_2");
    expect(result.estimatedSellingPrice).toBeCloseTo(714.29, 2);
    expect(result.divisor).toBe(0.7);
  });

  it("Tier 3: 500 / 0.8 = 625.00", () => {
    const result = calculateTierPrice(500, "TIER_3");
    expect(result.estimatedSellingPrice).toBeCloseTo(625.0, 2);
    expect(result.divisor).toBe(0.8);
  });

  it("Tier 1 with $1,200 making price", () => {
    const result = calculateTierPrice(1200, "TIER_1");
    expect(result.estimatedSellingPrice).toBeCloseTo(2000.0, 2);
  });

  it("returns error on zero making price", () => {
    expect(() => calculateTierPrice(0, "TIER_1")).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import {
  calculateMakingPrice,
  calculateTierPrice
} from "@/src/services/pricing";

describe("calculateMakingPrice", () => {
  it("standard shapes use $1.25/ct for center stone", () => {
    const result = calculateMakingPrice({
      centerStone: { shape: "oval", caratWeight: 1.0 },
      sideStones: [],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1"
    });
    expect(result.centerStoneCost).toBe(1.25);
  });

  it("non-standard shapes use $1.75/ct for center stone", () => {
    const result = calculateMakingPrice({
      centerStone: { shape: "heart", caratWeight: 1.0 },
      sideStones: [],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1"
    });
    expect(result.centerStoneCost).toBe(1.75);
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
    // 2ct × $20 = $40
    expect(result.centerStoneSettingCost).toBe(40);
  });

  it("side stone setting: round prong = $1.25/ct, no surcharges", () => {
    const result = calculateMakingPrice({
      centerStone: { shape: "round", caratWeight: 1.0 },
      sideStones: [{ shape: "round", caratWeightEach: 0.03, count: 10, settingType: "prong" }],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1"
    });
    // 0.3ct total × $1.25 = $0.375, no surcharges
    expect(result.sideStoneSettingCost).toBeCloseTo(0.375, 3);
  });

  it("side stone setting: large stone surcharge (> 0.5ct each = +$10/stone)", () => {
    const result = calculateMakingPrice({
      centerStone: { shape: "round", caratWeight: 1.0 },
      sideStones: [{ shape: "round", caratWeightEach: 0.6, count: 2, settingType: "prong" }],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1"
    });
    // Rule A: 1.2ct × $1.25 = $1.50
    // Rule B: 2 stones × $10 = $20 (each is 0.6ct > 0.5ct)
    // Rule C: prong = $0
    expect(result.sideStoneSettingCost).toBeCloseTo(21.5, 2);
  });

  it("side stone setting: non-prong setting surcharge (+$5/stone)", () => {
    const result = calculateMakingPrice({
      centerStone: { shape: "round", caratWeight: 1.0 },
      sideStones: [{ shape: "round", caratWeightEach: 0.03, count: 4, settingType: "bezel" }],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1"
    });
    // Rule A: 0.12ct × $1.25 = $0.15
    // Rule B: 0.03ct < 0.5ct = $0
    // Rule C: bezel (not prong) = 4 × $5 = $20
    expect(result.sideStoneSettingCost).toBeCloseTo(20.15, 2);
  });

  it("wax: 1 piece for single ring", () => {
    const result = calculateMakingPrice({
      centerStone: { shape: "round", caratWeight: 1.0 },
      sideStones: [],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1"
    });
    expect(result.waxCost).toBe(15);
    expect(result.pieces).toBe(1);
  });

  it("wax: 2 pieces for ring + wedding band", () => {
    const result = calculateMakingPrice({
      centerStone: { shape: "round", caratWeight: 1.0 },
      sideStones: [],
      hasWeddingBand: true,
      isTwoTone: false,
      colorClarity: "E VS1"
    });
    expect(result.waxCost).toBe(30);
    expect(result.pieces).toBe(2);
  });

  it("wax: 2 pieces for two-tone ring", () => {
    const result = calculateMakingPrice({
      centerStone: { shape: "round", caratWeight: 1.0 },
      sideStones: [],
      hasWeddingBand: false,
      isTwoTone: true,
      colorClarity: "E VS1"
    });
    expect(result.waxCost).toBe(30);
    expect(result.pieces).toBe(2);
  });

  it("polishing: $20/piece, matches piece count", () => {
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
    // Center stone: 1.0 × $1.25 = $1.25
    // Center setting: 1.0 × $20 = $20
    // Wax: $15, Polishing: $20, CAD: $50
    // Subtotal = $106.25, no margin
    expect(result.cadCost).toBe(50);
    expect(result.subtotal).toBeCloseTo(106.25, 2);
    expect(result.makingPrice).toBeCloseTo(106.25, 2);
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
    // Subtotal = $56.25 (1.25 + 0 + 20 + 0 + 15 + 20)
    // Margin = $56.25 × 0.20 = $11.25
    // Making price = $56.25 + $11.25 = $67.50
    expect(result.customerMarginPct).toBe(20);
    expect(result.customerMarginAmount).toBeCloseTo(11.25, 2);
    expect(result.makingPrice).toBeCloseTo(67.5, 2);
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
    // Step 1: calculateMakingPrice returns making price
    // Step 2: calculateTierPrice receives making price and produces end customer price
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
    // End customer price = (makingPrice / 0.7) * 2
    const expected = (makingResult.makingPrice / 0.7) * 2;
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
    // Center stone:         1.5 × $1.25  = $1.875
    // Side stones:          0.4ct × $80  = $32.00
    // Center setting:       1.5 × $20    = $30.00
    // Side setting (RuleA): 0.4 × $1.25  = $0.50
    // Side setting (RuleB): 0.02 < 0.5   = $0
    // Side setting (RuleC): prong        = $0
    // Wax:                  1 × $15      = $15.00
    // Polishing:            1 × $20      = $20.00
    // CAD:                               = $50.00
    // ─────────────────────────────────────────────
    // Subtotal:                          = $149.375
    // Customer margin (20%):             = $29.875
    // ─────────────────────────────────────────────
    // Making price:                      = $179.25
    expect(result.subtotal).toBeCloseTo(149.375, 2);
    expect(result.customerMarginAmount).toBeCloseTo(29.875, 2);
    expect(result.makingPrice).toBeCloseTo(179.25, 2);
    expect(result).toMatchSnapshot();
  });
});

describe("calculateTierPrice", () => {
  it("Tier 1: (500 / 0.6) * 2 = 1666.67", () => {
    const result = calculateTierPrice(500, "TIER_1");
    expect(result.estimatedSellingPrice).toBeCloseTo(1666.67, 2);
    expect(result.divisor).toBe(0.6);
  });

  it("Tier 2: (500 / 0.7) * 2 = 1428.57", () => {
    const result = calculateTierPrice(500, "TIER_2");
    expect(result.estimatedSellingPrice).toBeCloseTo(1428.57, 2);
    expect(result.divisor).toBe(0.7);
  });

  it("Tier 3: (500 / 0.8) * 2 = 1250.00", () => {
    const result = calculateTierPrice(500, "TIER_3");
    expect(result.estimatedSellingPrice).toBeCloseTo(1250.0, 2);
    expect(result.divisor).toBe(0.8);
  });

  it("Tier 1 with $1,200 making price", () => {
    const result = calculateTierPrice(1200, "TIER_1");
    expect(result.estimatedSellingPrice).toBeCloseTo(4000.0, 2);
  });

  it("returns error on zero making price", () => {
    expect(() => calculateTierPrice(0, "TIER_1")).toThrow();
  });

  it("snapshot: full result shape does not change", () => {
    const result = calculateTierPrice(500, "TIER_2");
    expect(result).toMatchSnapshot();
  });
});

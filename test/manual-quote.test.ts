import { describe, it, expect } from "vitest";
import { calculateMakingPrice, calculateTierPrice, DEFAULT_COLOR_CLARITY } from "@/src/services/pricing";
import { convertMetalWeight } from "@/lib/pricing";

describe("Manual Direct Quoting Calculations & Presets", () => {
  it("calculates live pricing accurately for manual specifications", () => {
    const goldSpotPerOz = 2500;
    const cadCost = 20;
    const customerMarginPct = 25;
    const pricingTier = "TIER_2";

    const makingPriceBreakdown = calculateMakingPrice({
      metalType: "14K",
      metalWeightGrams: 4.5,
      goldSpotPerOz,
      centerStone: {
        shape: "round",
        caratWeight: 1.0
      },
      sideStones: [
        {
          shape: "round",
          caratWeightEach: 0.015,
          count: 24,
          settingType: "pave"
        }
      ],
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: DEFAULT_COLOR_CLARITY,
      cadCost,
      pricingTier,
      customerMarginPct
    });

    const tierResult = calculateTierPrice(
      makingPriceBreakdown.subtotal,
      pricingTier,
      customerMarginPct
    );

    expect(makingPriceBreakdown.subtotal).toBeGreaterThan(0);
    expect(makingPriceBreakdown.cadCost).toBe(20);
    expect(tierResult.estimatedSellingPrice).toBeGreaterThan(makingPriceBreakdown.subtotal);
  });

  it("calculates custom fancy center stone manual quote (e.g. 1.5ct Oval Halo)", () => {
    const goldSpotPerOz = 3000;
    const cadCost = 25;
    const customerMarginPct = 30;
    const pricingTier = "TIER_1";

    const breakdown = calculateMakingPrice({
      metalType: "18K",
      metalWeightGrams: 5.4,
      goldSpotPerOz,
      centerStone: {
        shape: "oval",
        caratWeight: 1.5
      },
      sideStones: [
        {
          shape: "fancy",
          caratWeightEach: 0.02,
          count: 28,
          settingType: "pave"
        }
      ],
      hasWeddingBand: true,
      isTwoTone: true,
      colorClarity: "E VS1",
      cadCost,
      pricingTier,
      customerMarginPct
    });

    expect(breakdown.metalCost).toBeGreaterThan(0);
    expect(breakdown.centerStoneCost).toBeGreaterThan(0);
    expect(breakdown.sideStoneCost).toBeGreaterThan(0);
    expect(breakdown.subtotal).toBeGreaterThan(breakdown.metalCost);
  });

  it("correctly converts metal weights when switching alloys in manual mode", () => {
    const weight14K = 4.5;
    const weight18K = convertMetalWeight(weight14K, "14K", "18K");
    const weightPlat = convertMetalWeight(weight14K, "14K", "Platinum");

    expect(weight18K).toBeGreaterThan(weight14K);
    expect(weightPlat).toBeGreaterThan(weight18K);
  });
});

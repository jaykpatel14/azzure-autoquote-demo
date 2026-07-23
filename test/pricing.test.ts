import { describe, expect, test } from "vitest";
import { calculateQuote, convertMetalWeight } from "@/lib/pricing";

describe("pricing", () => {
  test("convertMetalWeight scales by density ratio", () => {
    const converted = convertMetalWeight(10, "14K", "18K");
    expect(Number(converted.toFixed(4))).toBe(Number((10 * (15.6 / 13.1)).toFixed(4)));
  });

  test("calculateQuote respects profile overrides", () => {
    const quote = calculateQuote(
      {
        metalType: "14K",
        metalWeightGrams: 5,
        centerDiamondCarats: 1.2,
        sideDiamondCarats: 0.4,
        sideDiamondQuantity: 12
      },
      {
        goldSpotPerOz: 3000,
        cadCharge: 50,
        centerSettingPerCarat: 20,
        sideSettingPerStone: 4,
        sellingMarginDivisor: 0.5,
        finalMultiplier: 1.5
      }
    );

    const metalCost = (3000 / 31.1034768) * 0.585 * 1.15 * 5;
    const diamondCost = 125 * 1.6;
    const makingCost = metalCost + diamondCost + 50 + 1.2 * 20 + 12 * 4;
    const expected = Math.round((makingCost / 0.5) * 1.5 * 100) / 100;

    expect(quote.estimatedFinalPrice).toBe(expected);
  });
});

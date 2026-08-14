import { describe, expect, it } from "vitest";
import { calculateTierPrice } from "@/src/services/pricing";

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

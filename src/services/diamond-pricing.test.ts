import { describe, expect, it } from "vitest";
import {
  getCenterStonePricePerCarat,
  getSideStonePricePerCarat
} from "@/src/services/diamond-pricing";

describe("CKNYC supplied diamond pricing tables", () => {
  it("uses the exact lab center table band", () => {
    expect(getCenterStonePricePerCarat({
      origin: "lab",
      shape: "round",
      colorClarity: "D VVS1",
      caratWeight: 2.6,
      gemstonePerCarat: 40
    }).pricePerCarat).toBe(220);
  });

  it("changes the lab center rate when the supplied quality rows differ", () => {
    const dVvs1 = getCenterStonePricePerCarat({ origin: "lab", shape: "round", colorClarity: "D VVS1", caratWeight: 2, gemstonePerCarat: 40 });
    const eVs1 = getCenterStonePricePerCarat({ origin: "lab", shape: "round", colorClarity: "E VS1", caratWeight: 2, gemstonePerCarat: 40 });
    expect(dVvs1.pricePerCarat).toBe(150);
    expect(eVs1.pricePerCarat).toBe(125);
    expect(dVvs1.pricePerCarat).not.toBe(eVs1.pricePerCarat);
  });

  it("keeps equal lab rates equal when that is what the supplied 0.50–1.00ct rows specify", () => {
    const dVvs1 = getCenterStonePricePerCarat({ origin: "lab", shape: "round", colorClarity: "D VVS1", caratWeight: 1, gemstonePerCarat: 40 });
    const eVs1 = getCenterStonePricePerCarat({ origin: "lab", shape: "round", colorClarity: "E VS1", caratWeight: 1, gemstonePerCarat: 40 });
    expect(dVvs1.pricePerCarat).toBe(100);
    expect(eVs1.pricePerCarat).toBe(100);
  });

  it("uses the natural round table value times 100 and the 30% discount", () => {
    const result = getCenterStonePricePerCarat({
      origin: "natural",
      shape: "round",
      colorClarity: "E VS1",
      caratWeight: 1,
      gemstonePerCarat: 40
    });
    expect(result.pricePerCarat).toBe(5250);
    expect(result.discountPct).toBe(30);
  });

  it("uses the 40% natural discount for G-M colors", () => {
    const result = getCenterStonePricePerCarat({
      origin: "natural",
      shape: "round",
      colorClarity: "G VS1",
      caratWeight: 1,
      gemstonePerCarat: 40
    });
    expect(result.pricePerCarat).toBe(3540);
    expect(result.discountPct).toBe(40);
  });

  it("uses the supplied fixed side-stone rates", () => {
    expect(getSideStonePricePerCarat({ origin: "lab", shape: "fancy", colorClarity: "E VS1", caratWeightEach: 0.1, gemstonePerCarat: 40 }).pricePerCarat).toBe(150);
    expect(getSideStonePricePerCarat({ origin: "natural", shape: "fancy", colorClarity: "E VS1", caratWeightEach: 0.4, gemstonePerCarat: 40 }).pricePerCarat).toBe(1200);
    expect(getSideStonePricePerCarat({ origin: "natural", shape: "fancy", colorClarity: "E VS1", caratWeightEach: 0.5, gemstonePerCarat: 40 }).pricePerCarat).toBe(2500);
  });

  it("uses $40 per carat for gemstones", () => {
    expect(getCenterStonePricePerCarat({ origin: "gemstone", shape: "oval", colorClarity: "", caratWeight: 2, gemstonePerCarat: 40 }).pricePerCarat).toBe(40);
  });
});

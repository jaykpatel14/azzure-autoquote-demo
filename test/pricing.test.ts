import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { calculateQuote, convertMetalWeight } from "@/lib/pricing";
import { resolveMetalPricing } from "@/lib/metal-pricing";
import { prisma } from "@/lib/prisma";

beforeEach(async () => {
  await prisma.appSetting.deleteMany({
    where: { key: "METALS_LIVE_PRICING_CACHE_V1" }
  });
});

afterEach(async () => {
  await prisma.appSetting.deleteMany({
    where: { key: "METALS_LIVE_PRICING_CACHE_V1" }
  });
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

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

  test("resolveMetalPricing uses live Metals.dev rates when configured", async () => {
    vi.stubEnv("METALS_DEV_API_KEY", "test-key");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "success",
          timestamp: "2026-07-27T12:00:00.000Z",
          metals: {
            gold: 3210.5,
            platinum: 1450.25,
            silver: 36.75
          }
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      ) as Response
    );

    const result = await resolveMetalPricing({
      goldSpotPerOz: 4500,
      platinumSpotPerOz: 2000,
      silverSpotPerOz: 100,
      cadCharge: 25,
      centerSettingPerCarat: 15,
      sideSettingPerStone: 3,
      sellingMarginDivisor: 0.7,
      finalMultiplier: 2
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.source).toBe("metals.dev");
    expect(result.pricingProfile.goldSpotPerOz).toBe(3210.5);
    expect(result.pricingProfile.platinumSpotPerOz).toBe(1450.25);
    expect(result.pricingProfile.silverSpotPerOz).toBe(36.75);
  });

  test("resolveMetalPricing falls back when no API key is configured", async () => {
    vi.stubEnv("METALS_DEV_API_KEY", "");
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const result = await resolveMetalPricing({
      goldSpotPerOz: 3000,
      platinumSpotPerOz: 2000,
      silverSpotPerOz: 100,
      cadCharge: 25,
      centerSettingPerCarat: 15,
      sideSettingPerStone: 3,
      sellingMarginDivisor: 0.7,
      finalMultiplier: 2
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.source).toBe("configured-default");
    expect(result.pricingProfile.goldSpotPerOz).toBe(3000);
  });
});

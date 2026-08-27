import { afterEach, describe, expect, test, vi } from "vitest";
import { calculateQuote, convertMetalWeight } from "@/lib/pricing";

type AppSettingRecord = { key: string; value: string };

const { appSettingStore, prismaMock } = vi.hoisted(() => {
  const appSettingStore = new Map<string, string>();
  const prismaMock = {
    appSetting: {
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) => {
        const value = appSettingStore.get(where.key);
        return value ? ({ key: where.key, value } as AppSettingRecord) : null;
      }),
      upsert: vi.fn(async ({ where, create, update }: { where: { key: string }; create: AppSettingRecord; update: Partial<AppSettingRecord> }) => {
        const value = update.value ?? create.value;
        appSettingStore.set(where.key, value);
        return { key: where.key, value } as AppSettingRecord;
      }),
      create: vi.fn(async ({ data }: { data: AppSettingRecord }) => {
        appSettingStore.set(data.key, data.value);
        return data;
      }),
      deleteMany: vi.fn(async ({ where }: { where?: { key?: string } }) => {
        if (where?.key) {
          appSettingStore.delete(where.key);
        } else {
          appSettingStore.clear();
        }
        return { count: 0 };
      })
    }
  };

  return { appSettingStore, prismaMock };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/app-settings", () => ({
  resolveRuntimeSetting: vi.fn(async (_key: string, fallback?: string | null) => fallback ?? null)
}));

import { resolveMetalPricing } from "@/lib/metal-pricing";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  appSettingStore.clear();
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

  test("resolveMetalPricing keeps cached live prices when Metals.dev is quota-limited", async () => {
    vi.stubEnv("METALS_DEV_API_KEY", "test-key");
    await prismaMock.appSetting.create({
      data: {
        key: "METALS_LIVE_PRICING_CACHE_V2",
        value: JSON.stringify({
          fetchedAt: "2026-08-27T13:00:00.000Z",
          torontoDate: "2026-08-26",
          pricingProfile: {
            goldSpotPerOz: 3333.33,
            platinumSpotPerOz: 1444.44,
            silverSpotPerOz: 27.77
          },
          timestamp: "2026-08-27T13:00:00.000Z",
          message: "Cached live market spot prices loaded from Metals.dev at 2026-08-27T13:00:00.000Z."
        })
      }
    });

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "error",
          error_message: "Your plan quota for the month is exhausted."
        }),
        {
          status: 400,
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
    expect(result.pricingProfile.goldSpotPerOz).toBe(3333.33);
    expect(result.pricingProfile.platinumSpotPerOz).toBe(1444.44);
    expect(result.pricingProfile.silverSpotPerOz).toBe(27.77);
    expect(result.message).toContain("most recent live prices");
  });

  test("resolveMetalPricing switches to MetalpriceAPI when Metals.dev fails", async () => {
    vi.stubEnv("METALS_DEV_API_KEY", "primary-key");
    vi.stubEnv("METALPRICE_API_KEY", "backup-key");

    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "error",
            error_message: "Your plan quota for the month is exhausted."
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        ) as Response
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            timestamp: 1753617600,
            base: "USD",
            // MetalpriceAPI with `base=USD` returns rates as "how many oz of
            // metal equal 1 USD" — the inverse of USD/oz. Realistic values:
            // gold ~$3,222/oz, platinum ~$1,477/oz, silver ~$35.80/oz.
            rates: {
              "XAU": 1 / 3222.1,
              "XPT": 1 / 1477.4,
              "XAG": 1 / 35.8
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

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.source).toBe("metalpriceapi");
    expect(result.pricingProfile.goldSpotPerOz).toBe(3222.1);
    expect(result.pricingProfile.platinumSpotPerOz).toBe(1477.4);
    expect(result.pricingProfile.silverSpotPerOz).toBe(35.8);
  });
});

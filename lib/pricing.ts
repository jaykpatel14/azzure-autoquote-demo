export type MetalType = "10K" | "14K" | "18K" | "Platinum" | "Silver";

export const METAL_TYPES: readonly MetalType[] = [
  "10K",
  "14K",
  "18K",
  "Platinum",
  "Silver"
] as const;

export type PricingInput = {
  metalType: MetalType;
  metalWeightGrams: number;
  centerDiamondCarats: number;
  sideDiamondCarats: number;
  sideDiamondQuantity: number;
};

export type PricingProfileInput = Partial<{
  goldSpotPerOz: number;
  platinumSpotPerOz: number;
  silverSpotPerOz: number;
  cadCharge: number;
  centerSettingPerCarat: number;
  sideSettingPerStone: number;
  sellingMarginDivisor: number;
  finalMultiplier: number;
}>;

export const DEFAULT_PRICING_PROFILE = {
  goldSpotPerOz: 4500,
  platinumSpotPerOz: 2000,
  silverSpotPerOz: 100,
  cadCharge: 25,
  centerSettingPerCarat: 15,
  sideSettingPerStone: 3,
  sellingMarginDivisor: 0.7,
  finalMultiplier: 2
} as const;

const PURITY: Record<"10K" | "14K" | "18K", number> = {
  "10K": 0.417,
  "14K": 0.585,
  "18K": 0.75
};

export const METAL_DENSITY: Record<MetalType, number> = {
  "10K": 11.6,
  "14K": 13.1,
  "18K": 15.6,
  Platinum: 21.45,
  Silver: 10.49
};

export function convertMetalWeight(
  weightGrams: number,
  fromMetal: MetalType,
  toMetal: MetalType
): number {
  if (weightGrams <= 0 || fromMetal === toMetal) return Math.max(0, weightGrams);
  const fromDensity = METAL_DENSITY[fromMetal] ?? 13.1;
  const toDensity = METAL_DENSITY[toMetal] ?? 13.1;
  return weightGrams * (toDensity / fromDensity);
}

function resolvePricingProfile(profile: PricingProfileInput = {}) {
  return {
    ...DEFAULT_PRICING_PROFILE,
    ...profile
  };
}

export function mergePricingProfiles(
  baseProfile?: PricingProfileInput | null,
  overlay?: Partial<PricingProfileInput> | null
): PricingProfileInput {
  const base = resolvePricingProfile(baseProfile ?? {});
  const extra = overlay ?? {};

  return {
    goldSpotPerOz: base.goldSpotPerOz + (extra.goldSpotPerOz ?? 0),
    platinumSpotPerOz: base.platinumSpotPerOz + (extra.platinumSpotPerOz ?? 0),
    silverSpotPerOz: base.silverSpotPerOz + (extra.silverSpotPerOz ?? 0),
    cadCharge: base.cadCharge + (extra.cadCharge ?? 0),
    centerSettingPerCarat: base.centerSettingPerCarat + (extra.centerSettingPerCarat ?? 0),
    sideSettingPerStone: base.sideSettingPerStone + (extra.sideSettingPerStone ?? 0),
    sellingMarginDivisor: base.sellingMarginDivisor + (extra.sellingMarginDivisor ?? 0),
    finalMultiplier: base.finalMultiplier + (extra.finalMultiplier ?? 0)
  };
}

function metalRatePerGram(type: MetalType, profile: PricingProfileInput = {}): number {
  const config = resolvePricingProfile(profile);
  const ozToGram = 31.1034768;
  if (type === "Platinum") return (config.platinumSpotPerOz / ozToGram) * 1.3;
  if (type === "Silver") return (config.silverSpotPerOz / ozToGram) * 3.5;
  return (config.goldSpotPerOz / ozToGram) * PURITY[type] * 1.15;
}

function diamondRate(color = "G", clarity = "VS1", totalCarats = 0): number {
  if (color === "D" && clarity === "VVS1") return totalCarats <= 3 ? 200 : 400;
  if (color === "D" && clarity === "VVS2") return 150;
  if (color === "E" && clarity === "VVS2") return 130;
  return 125;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateQuote(input: PricingInput, profile: PricingProfileInput = {}) {
  const config = resolvePricingProfile(profile);
  const totalDiamondCarats = input.centerDiamondCarats + input.sideDiamondCarats;
  const metalCost = metalRatePerGram(input.metalType, config) * input.metalWeightGrams;
  const diamondCost = diamondRate("G", "VS1", totalDiamondCarats) * totalDiamondCarats;
  const makingCost =
    metalCost +
    diamondCost +
    config.cadCharge +
    input.centerDiamondCarats * config.centerSettingPerCarat +
    input.sideDiamondQuantity * config.sideSettingPerStone;
  const sellingPrice = makingCost / Math.max(config.sellingMarginDivisor, 0.01);
  const estimatedFinalPrice = sellingPrice * Math.max(config.finalMultiplier, 0);

  return {
    estimatedFinalPrice: roundMoney(estimatedFinalPrice),
    makingCost: roundMoney(makingCost),
    sellingPrice: roundMoney(sellingPrice)
  };
}

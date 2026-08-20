import type { PricingTier } from "@prisma/client";

export const TIER_DIVISORS: Record<PricingTier, number> = {
  TIER_1: 0.6,
  TIER_2: 0.7,
  TIER_3: 0.8
};

const TIER_LABELS: Record<PricingTier, string> = {
  TIER_1: "Tier 1 - Premium",
  TIER_2: "Tier 2 - Standard",
  TIER_3: "Tier 3 - Basic"
};

export const DEFAULT_COLOR_CLARITY = "E VS1" as const;

export const STANDARD_CENTER_SHAPES = [
  "oval",
  "round",
  "radiant",
  "cushion",
  "cushioned",
  "elongated",
  "marquise",
  "emerald",
  "pear"
];

export const PRONG_SETTING_ALIASES = [
  "prong",
  "claw",
  "standard prong",
  "four prong",
  "six prong"
];

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function isCenterStoneStandardShape(shape: string): boolean {
  if (!shape) return false;
  const normalised = shape.toLowerCase().trim();
  return STANDARD_CENTER_SHAPES.some((s) => normalised.includes(s));
}

export function centerStoneCost(caratWeight: number, shape: string): number {
  const pricePerCarat = isCenterStoneStandardShape(shape) ? 125 : 175;
  return caratWeight * pricePerCarat;
}


export function isSideStoneRound(shape: string): boolean {
  if (!shape) return false;
  return shape.toLowerCase().trim() === "round";
}

export function sideStoneCost(
  caratWeightEach: number,
  count: number,
  shape: string
): number {
  const pricePerCarat = isSideStoneRound(shape) ? 80 : 130;
  const totalCaratWeight = caratWeightEach * count;
  return totalCaratWeight * pricePerCarat;
}

export function centerStoneSettingCost(caratWeight: number): number {
  return caratWeight * 20;
}

export type SideStoneSettingInput = {
  caratWeightEach: number;
  count: number;
  shape: string;
  settingType: string;
};

export function isProngSetting(settingType: string): boolean {
  if (!settingType) return false;
  const normalised = settingType.toLowerCase().trim();
  return PRONG_SETTING_ALIASES.some((s) => normalised.includes(s));
}

export function sideStoneSettingCost(input: SideStoneSettingInput): number {
  const { count, settingType } = input;
  const ratePerStone = isProngSetting(settingType) ? 1.25 : 5.0;
  return count * ratePerStone;
}

export type WaxInput = {
  hasWeddingBand: boolean;
  isTwoTone: boolean;
};

export function pieceCount(input: WaxInput): 1 | 2 {
  return input.hasWeddingBand || input.isTwoTone ? 2 : 1;
}

export function waxCost(input: WaxInput): number {
  return pieceCount(input) * 15;
}

export function polishingCost(input: WaxInput): number {
  return pieceCount(input) * 20;
}

export type MakingPriceInput = {
  metalType?: string;
  metalWeightGrams?: number;
  goldSpotPerOz?: number;

  // Center stone
  centerStone: {
    shape: string;
    caratWeight: number;
  };

  // Side stones (can be empty array if no side stones)
  sideStones: Array<{
    shape: string;
    caratWeightEach: number;
    count: number;
    settingType: string;
  }>;

  // Piece configuration
  hasWeddingBand: boolean;
  isTwoTone: boolean;

  // Fixed — never changes
  colorClarity?: "E VS1" | string;

  // Admin-configured CAD flat fee (snapshotted from platform settings at quote creation)
  cadCost?: number;

  // Jeweler margin percentage (snapshotted from company settings at quote creation)
  customerMarginPct?: number;
};

export type MakingPriceBreakdown = {
  metalCost: number;
  // Stone costs
  centerStoneCost: number;
  sideStoneCost: number;
  // Setting costs
  centerStoneSettingCost: number;
  sideStoneSettingCost: number;
  // Production costs
  waxCost: number;
  polishingCost: number;
  cadCost: number;
  // Jeweler margin
  customerMarginPct: number;
  customerMarginAmount: number;
  // Totals
  subtotal: number;
  makingPrice: number;
  pieces: 1 | 2;
  colorClarity: "E VS1";
};

export function calculateMetalCost(
  metalType = "14K",
  weightGrams = 0,
  spotPrice = 4500,
  wastagePct = 25
): number {
  if (weightGrams <= 0) return 0;
  const ozToGram = 31.1034768;
  const normalized = (metalType || "14K").toUpperCase().trim();
  
  let purity = 0.585; // 14K default
  let lossFactor = 1 + (wastagePct / 100); // 1.25 default

  if (normalized.includes("PLATINUM") || normalized.includes("PLAT")) {
    purity = 0.95;
    lossFactor = 1.35;
  } else if (normalized.includes("SILVER") || normalized.includes("925")) {
    purity = 0.925;
    lossFactor = 3.5;
  } else if (normalized.includes("18K") || normalized.includes("18")) {
    purity = 0.75;
    lossFactor = 1 + (wastagePct / 100);
  } else if (normalized.includes("10K") || normalized.includes("10")) {
    purity = 0.417;
    lossFactor = 1 + (wastagePct / 100);
  } else {
    // 14K or fallback
    purity = 0.585;
    lossFactor = 1 + (wastagePct / 100);
  }

  const ratePerGram = (spotPrice / ozToGram) * purity * lossFactor;
  return weightGrams * ratePerGram;
}


export function calculateMakingPrice(
  input: MakingPriceInput
): MakingPriceBreakdown {
  const cadCost = input.cadCost ?? 0;
  const customerMarginPct = input.customerMarginPct ?? 0;

  // Validate inputs
  if (input.centerStone.caratWeight <= 0) {
    throw new ValidationError("Center stone carat weight must be greater than zero");
  }
  if (customerMarginPct < 0 || customerMarginPct > 200) {
    throw new ValidationError("Customer margin must be between 0% and 200%");
  }
  if (cadCost < 0) {
    throw new ValidationError("CAD cost cannot be negative");
  }

  const _metalCost = calculateMetalCost(
    input.metalType ?? "14K",
    input.metalWeightGrams ?? 0,
    input.goldSpotPerOz ?? 4500,
    25
  );

  const _centerStoneCost = centerStoneCost(
    input.centerStone.caratWeight,
    input.centerStone.shape
  );

  const _sideStoneCost = input.sideStones.reduce((total, ss) => {
    return total + sideStoneCost(ss.caratWeightEach, ss.count, ss.shape);
  }, 0);

  const _centerStoneSettingCost = centerStoneSettingCost(
    input.centerStone.caratWeight
  );

  const _sideStoneSettingCost = input.sideStones.reduce((total, ss) => {
    return total + sideStoneSettingCost(ss);
  }, 0);

  const pieceConfig: WaxInput = {
    hasWeddingBand: input.hasWeddingBand,
    isTwoTone: input.isTwoTone
  };

  const _waxCost = waxCost(pieceConfig);
  const _polishingCost = polishingCost(pieceConfig);
  const _cadCost = cadCost;

  // Subtotal = all components (metal + stones + labor + cad) before customer margin
  const subtotal =
    _metalCost +
    _centerStoneCost +
    _sideStoneCost +
    _centerStoneSettingCost +
    _sideStoneSettingCost +
    _waxCost +
    _polishingCost +
    _cadCost;

  // Customer margin applied to subtotal
  const _customerMarginAmount = subtotal * (customerMarginPct / 100);

  // Making price = subtotal + customer margin
  const makingPrice = Math.round((subtotal + _customerMarginAmount) * 100) / 100;

  return {
    metalCost: Math.round(_metalCost * 100) / 100,
    centerStoneCost: _centerStoneCost,
    sideStoneCost: _sideStoneCost,
    centerStoneSettingCost: _centerStoneSettingCost,
    sideStoneSettingCost: _sideStoneSettingCost,
    waxCost: _waxCost,
    polishingCost: _polishingCost,
    cadCost: _cadCost,
    customerMarginPct,
    customerMarginAmount: Math.round(_customerMarginAmount * 100) / 100,
    subtotal: Math.round(subtotal * 100) / 100,
    makingPrice,
    pieces: pieceCount(pieceConfig),
    colorClarity: DEFAULT_COLOR_CLARITY
  };
}


export type TierPriceResult = {
  makingPrice: number;
  tier: PricingTier;
  divisor: number;
  estimatedSellingPrice: number;
  formattedBreakdown: {
    makingPrice: string;
    estimatedSellingPrice: string;
    tierLabel: string;
  };
};

function formatCAD(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD"
  }).format(amount);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateTierPrice(makingPrice: number, tier: PricingTier): TierPriceResult {
  if (makingPrice <= 0) {
    throw new Error("Making price must be greater than zero.");
  }

  const divisor = TIER_DIVISORS[tier];
  const estimatedSellingPrice = roundMoney(makingPrice / divisor);

  return {
    makingPrice: roundMoney(makingPrice),
    tier,
    divisor,
    estimatedSellingPrice,
    formattedBreakdown: {
      makingPrice: formatCAD(makingPrice),
      estimatedSellingPrice: formatCAD(estimatedSellingPrice),
      tierLabel: TIER_LABELS[tier]
    }
  };
}

export function getPricingTierLabel(tier: PricingTier | null | undefined) {
  return tier ? TIER_LABELS[tier] : null;
}

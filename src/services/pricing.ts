import type { PricingTier } from "@prisma/client";
import { DEFAULT_PRICING_PROFILE, type PricingProfileInput } from "@/lib/pricing";
import { getCenterStonePricePerCarat, getSideStonePricePerCarat } from "@/src/services/diamond-pricing";

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


export function isSideStoneRound(shape?: string | null): boolean {
  if (!shape) return false;
  const normalized = shape.toLowerCase().trim();
  return normalized === "round" || normalized === "rounds" || normalized === "brilliant";
}

export function sideStoneCost(
  caratWeightEach: number,
  count: number,
  shape?: string | null
): number {
  const pricePerCarat = isSideStoneRound(shape) ? 80 : 130;
  const totalCaratWeight = caratWeightEach * count;
  return totalCaratWeight * pricePerCarat;
}

export function centerStoneSettingCost(caratWeight: number): number {
  return caratWeight * 20;
}

export type SideStoneSettingInput = {
  caratWeightEach?: number;
  count: number;
  shape?: string | null;
  settingType?: string | null;
};

export function isProngSetting(settingType: string): boolean {
  if (!settingType) return false;
  const normalised = settingType.toLowerCase().trim();
  return PRONG_SETTING_ALIASES.some((s) => normalised.includes(s));
}

export function sideStoneSettingCost(input: SideStoneSettingInput): number {
  const { count, shape } = input;
  const isRound = isSideStoneRound(shape);
  const ratePerStone = isRound ? 1.25 : 5.0;
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
  pricingProfile?: PricingProfileInput;
  quantity?: number;
  stoneOrigin?: "lab" | "natural" | "gemstone";
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
    shape?: string | null;
    caratWeightEach: number;
    count: number;
    settingType?: string | null;
  }>;

  // Piece configuration
  hasWeddingBand: boolean;
  isTwoTone: boolean;

  // Fixed — never changes
  colorClarity?: "E VS1" | string;

  // Admin-configured CAD flat fee (defaults to $20 flat fee)
  cadCost?: number;

  // Pricing tier (defaults to TIER_2 if not provided)
  pricingTier?: PricingTier;

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
  // Step 1: Production Subtotal (Azzure internal manufacturing raw cost)
  subtotal: number;
  // Step 2: Azzure Making Price (Tier formula applied on Production Subtotal)
  tierDivisor: number;
  makingPrice: number;
  // Step 3: Jeweler Markup (Jeweler adds margin on top of Making Price)
  customerMarginPct: number;
  customerMarginAmount: number;
  // End Customer Selling Price (What the end customer pays)
  estimatedSellingPrice: number;
  pieces: 1 | 2;
  colorClarity: "E VS1";
};

export function calculateMetalCost(
  metalType = "14K",
  weightGrams = 0,
  spotPrice = 4500,
  wastagePct = 25,
  profile: PricingProfileInput = {}
): number {
  if (weightGrams <= 0) return 0;
  const ozToGram = 31.1034768;
  const normalized = (metalType || "14K").toUpperCase().trim();
  
  const config = { ...DEFAULT_PRICING_PROFILE, ...profile };
  let purity = 0.585; // 14K default
  let lossFactor = 1 + (wastagePct / 100); // 1.25 default

  if (normalized.includes("PLATINUM") || normalized.includes("PLAT")) {
    return weightGrams * (Number(config.platinumSpotPerOz) / ozToGram) * (1 + Number(config.platinumLaborPct) / 100);
  } else if (normalized.includes("SILVER") || normalized.includes("925")) {
    return weightGrams * (Number(config.silverSpotPerOz) / ozToGram);
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
  const cadCost = input.cadCost !== undefined && input.cadCost !== null && !isNaN(input.cadCost) && input.cadCost > 0 ? input.cadCost : 20;
  const customerMarginPct = input.customerMarginPct ?? 0;
  const pricingTier = input.pricingTier ?? "TIER_2";
  const tierDivisor = TIER_DIVISORS[pricingTier] ?? 0.7;
  const pricing = { ...DEFAULT_PRICING_PROFILE, ...(input.pricingProfile ?? {}) };

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
    Number(pricing.goldWastagePct),
    pricing
  );

  const hasCenterStone = input.centerStone.caratWeight > 0.0001;
  const centerPrice = hasCenterStone
    ? getCenterStonePricePerCarat({
        origin: input.stoneOrigin ?? "lab",
        shape: input.centerStone.shape,
        colorClarity: input.colorClarity ?? DEFAULT_COLOR_CLARITY,
        caratWeight: input.centerStone.caratWeight,
        gemstonePerCarat: Number(pricing.gemstonePerCarat)
      })
    : { pricePerCarat: 0 };
  if (centerPrice.error) throw new ValidationError(centerPrice.error);
  const _centerStoneCost = hasCenterStone ? input.centerStone.caratWeight * centerPrice.pricePerCarat : 0;

  const _sideStoneCost = input.sideStones.reduce((total, ss) => {
    const sidePrice = getSideStonePricePerCarat({
      origin: input.stoneOrigin ?? "lab",
      shape: ss.shape ?? "round",
      colorClarity: input.colorClarity ?? DEFAULT_COLOR_CLARITY,
      caratWeightEach: ss.caratWeightEach,
      gemstonePerCarat: Number(pricing.gemstonePerCarat)
    });
    if (sidePrice.error) throw new ValidationError(sidePrice.error);
    return total + ss.caratWeightEach * ss.count * sidePrice.pricePerCarat;
  }, 0);

  const _centerStoneSettingCost = hasCenterStone ? input.centerStone.caratWeight * Number(pricing.centerSettingPerCarat) : 0;

  const _sideStoneSettingCost = input.sideStones.reduce((total, ss) => {
    return total + ss.count * (isSideStoneRound(ss.shape)
      ? Number(pricing.roundSideSettingPerStone)
      : Number(pricing.fancySideSettingPerStone));
  }, 0);

  const pieceConfig: WaxInput = {
    hasWeddingBand: input.hasWeddingBand,
    isTwoTone: input.isTwoTone
  };

  const quantity = Math.min(3, Math.max(1, Math.round(input.quantity ?? 1)));
  const configuredPieces = pieceCount(pieceConfig);
  const _waxCost = configuredPieces * Number(pricing.waxPerPiece) * quantity;
  const _polishingCost = configuredPieces * Number(pricing.polishingPerPiece) * quantity;
  const _cadCost = cadCost;

  // Step 1: Production Subtotal = all components (metal + stones + labor + cad) before tier formula and customer margin
  const subtotal = Math.round((
    _metalCost +
    _centerStoneCost +
    _sideStoneCost +
    _centerStoneSettingCost +
    _sideStoneSettingCost +
    _waxCost +
    _polishingCost +
    _cadCost
  ) * 100) / 100;

  // Step 2: Apply Tier Formula on top of Production Subtotal -> Azzure Making Price
  const makingPrice = Math.round((subtotal / tierDivisor) * 100) / 100;

  // Step 3: Customer / Jeweler adds Jeweler Markup on top of Tier Formula Price -> End Customer Price
  const _customerMarginAmount = Math.round((makingPrice * (customerMarginPct / 100)) * 100) / 100;
  const estimatedSellingPrice = Math.round((makingPrice + _customerMarginAmount) * 100) / 100;

  return {
    metalCost: Math.round(_metalCost * 100) / 100,
    centerStoneCost: Math.round(_centerStoneCost * 100) / 100,
    sideStoneCost: Math.round(_sideStoneCost * 100) / 100,
    centerStoneSettingCost: Math.round(_centerStoneSettingCost * 100) / 100,
    sideStoneSettingCost: Math.round(_sideStoneSettingCost * 100) / 100,
    waxCost: _waxCost,
    polishingCost: _polishingCost,
    cadCost: _cadCost,
    subtotal,
    tierDivisor,
    makingPrice,
    customerMarginPct,
    customerMarginAmount: _customerMarginAmount,
    estimatedSellingPrice,
    pieces: pieceCount(pieceConfig),
    colorClarity: DEFAULT_COLOR_CLARITY
  };
}


export type TierPriceResult = {
  subtotal: number;
  makingPrice: number;
  tier: PricingTier;
  divisor: number;
  customerMarginPct: number;
  customerMarginAmount: number;
  estimatedSellingPrice: number;
  formattedBreakdown: {
    subtotal: string;
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

export function calculateTierPrice(
  subtotal: number,
  tier: PricingTier = "TIER_2",
  customerMarginPct = 0
): TierPriceResult {
  if (subtotal <= 0) {
    throw new Error("Production subtotal must be greater than zero.");
  }

  const divisor = TIER_DIVISORS[tier] || 0.7;
  // Step 1: Production Subtotal
  // Step 2: Apply Tier Formula on top of Production Subtotal -> Azzure Making Price
  const makingPrice = roundMoney(subtotal / divisor);
  // Step 3: Customer / Jeweler adds Jeweler Markup on top of Tier Formula Price -> End Customer Price
  const customerMarginAmount = roundMoney(makingPrice * (customerMarginPct / 100));
  const estimatedSellingPrice = roundMoney(makingPrice + customerMarginAmount);

  return {
    subtotal: roundMoney(subtotal),
    makingPrice,
    tier,
    divisor,
    customerMarginPct,
    customerMarginAmount,
    estimatedSellingPrice,
    formattedBreakdown: {
      subtotal: formatCAD(subtotal),
      makingPrice: formatCAD(makingPrice),
      estimatedSellingPrice: formatCAD(estimatedSellingPrice),
      tierLabel: TIER_LABELS[tier]
    }
  };
}

export function getPricingTierLabel(tier: PricingTier | null | undefined) {
  return tier ? TIER_LABELS[tier] : null;
}


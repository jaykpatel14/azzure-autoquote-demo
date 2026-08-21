import { CKNYC_PRICING_DATA } from "@/src/services/cknyc-pricing-data";

export type DiamondOrigin = "lab" | "natural" | "gemstone";

type PriceResult = {
  pricePerCarat: number;
  discountPct?: number;
  error?: string;
};

function splitQuality(colorClarity?: string) {
  const [rawColor = "E", rawClarity = "VS1"] = (colorClarity || "E VS1").toUpperCase().trim().split(/\s+/);
  return {
    color: rawColor === "G/H" || rawColor === "G" || rawColor === "H" ? "G OR H" : rawColor,
    naturalColor: rawColor === "G/H" ? "G" : rawColor,
    clarity: rawClarity
  };
}

export function estimateRoundMillimeters(caratWeightEach: number) {
  if (caratWeightEach <= 0) return 0;
  return 6.5 * Math.cbrt(caratWeightEach);
}

export function getLabCenterPricePerCarat(colorClarity: string, caratWeight: number): PriceResult {
  if (caratWeight < 0.5) return { pricePerCarat: 0, error: "Lab center pricing starts at 0.50 ct." };
  const { color, clarity } = splitQuality(colorClarity);
  const lookupWeight = Math.min(caratWeight, 5);
  const row = CKNYC_PRICING_DATA.labCenterRows.find(
    (entry) => entry.color === color && entry.clarity === clarity && lookupWeight >= entry.min && lookupWeight <= entry.max
  );
  return row
    ? { pricePerCarat: row.ppc }
    : { pricePerCarat: 0, error: `No lab center price for ${colorClarity} at ${caratWeight.toFixed(2)} ct.` };
}

function naturalDiscount(color: string, clarity: string) {
  const valueColors = ["G", "H", "I", "J", "K", "L", "M"];
  const valueClarities = ["SI1", "SI2", "SI3", "I1", "I2", "I3"];
  return valueColors.includes(color) || valueClarities.includes(clarity) ? 40 : 30;
}

function getNaturalTable(shape: string) {
  const normalized = shape.toLowerCase();
  if (normalized.includes("round")) return CKNYC_PRICING_DATA.naturalRounds;
  if (normalized.includes("pear")) return CKNYC_PRICING_DATA.naturalPears;
  return null;
}

export function getNaturalPricePerCarat(shape: string, colorClarity: string, caratWeight: number): PriceResult {
  const table = getNaturalTable(shape);
  if (!table) return { pricePerCarat: 0, error: "Natural center pricing from the supplied table supports Round and Pear only." };
  const band = Object.keys(table).find((key) => {
    const [min, max] = key.split("-").map(Number);
    return caratWeight >= min && caratWeight <= max;
  }) as keyof typeof table | undefined;
  if (!band) return { pricePerCarat: 0, error: `Natural ${shape} pricing is unavailable at ${caratWeight.toFixed(2)} ct.` };

  const { naturalColor: color, clarity } = splitQuality(colorClarity);
  const colorTable = table[band] as Record<string, Record<string, number>>;
  const rapValue = colorTable[color]?.[clarity];
  if (rapValue === undefined) return { pricePerCarat: 0, error: `No natural price for ${color} ${clarity} in ${String(band)}.` };
  const discountPct = naturalDiscount(color, clarity);
  return { pricePerCarat: rapValue * 100 * (1 - discountPct / 100), discountPct };
}

export function getCenterStonePricePerCarat(input: {
  origin: DiamondOrigin;
  shape: string;
  colorClarity: string;
  caratWeight: number;
  gemstonePerCarat: number;
}): PriceResult {
  if (input.origin === "gemstone") return { pricePerCarat: input.gemstonePerCarat };
  return input.origin === "natural"
    ? getNaturalPricePerCarat(input.shape, input.colorClarity, input.caratWeight)
    : getLabCenterPricePerCarat(input.colorClarity, input.caratWeight);
}

export function getSideStonePricePerCarat(input: {
  origin: DiamondOrigin;
  shape: string;
  colorClarity: string;
  caratWeightEach: number;
  gemstonePerCarat: number;
}): PriceResult {
  if (input.origin === "gemstone") return { pricePerCarat: input.gemstonePerCarat };
  const round = input.shape.toLowerCase().includes("round");
  const millimeters = estimateRoundMillimeters(input.caratWeightEach);

  if (input.origin === "lab") {
    if (!round) return { pricePerCarat: 150 };
    if (millimeters <= 1.2) return { pricePerCarat: 130 };
    if (millimeters <= 3) return { pricePerCarat: 70 };
    if (millimeters <= 4) return { pricePerCarat: 80 };
    return { pricePerCarat: 90 };
  }

  if (round) {
    if (millimeters <= 2.5) return { pricePerCarat: 400 };
    if (millimeters <= 4) return { pricePerCarat: 700 };
    if (millimeters <= 5) return { pricePerCarat: 1100 };
    return getNaturalPricePerCarat("round", input.colorClarity, input.caratWeightEach);
  }
  if (input.caratWeightEach <= 0.4) return { pricePerCarat: 1200 };
  if (input.caratWeightEach <= 0.5) return { pricePerCarat: 2500 };
  return getNaturalPricePerCarat("pear", input.colorClarity, input.caratWeightEach);
}

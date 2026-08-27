import { prisma } from "@/lib/prisma";
import type { AccentColorStoneSpec } from "@/lib/ai/schema";

const DEFAULT_TIER = "commercial" as const;
const DEFAULT_ACCENT_CARAT = 0.5;
const UNKNOWN_STONE_FALLBACK = {
  lowPerCt: 50,
  highPerCt: 300,
  note: "Unknown stone — using a conservative fallback range. Confirm with your jeweler."
};

export type GemstoneTierPrices = {
  lowPerCt: number;
  highPerCt: number;
};

export type GemstoneRateSummary = {
  stone: string;
  displayName: string;
  commercial: GemstoneTierPrices;
  fine: GemstoneTierPrices;
  premium: GemstoneTierPrices;
  sources?: string | null;
  refreshedAt: string;
  reviewedAt: string | null;
  isActive: boolean;
};

export type AccentStoneLineItem = {
  stone: string;
  count: number;
  caratWeightEach: number;
  totalCarats: number;
  lowTotal: number;
  highTotal: number;
};

export type AccentStoneCostEstimate = {
  tier: "commercial";
  caratWeightEach: number;
  lineItems: AccentStoneLineItem[];
  lowTotal: number;
  highTotal: number;
  disclaimer: string;
};

type GemstoneRateRow = {
  stone: string;
  displayName: string;
  commercialLowPerCt: unknown;
  commercialHighPerCt: unknown;
  fineLowPerCt: unknown;
  fineHighPerCt: unknown;
  premiumLowPerCt: unknown;
  premiumHighPerCt: unknown;
  sources: string | null;
  refreshedAt: Date;
  reviewedAt: Date | null;
  isActive: boolean;
};

function toTierPrices(low: unknown, high: unknown): GemstoneTierPrices {
  const lowPerCt = Number(low);
  const highPerCt = Number(high);
  return {
    lowPerCt: Number.isFinite(lowPerCt) ? lowPerCt : UNKNOWN_STONE_FALLBACK.lowPerCt,
    highPerCt: Number.isFinite(highPerCt) ? highPerCt : UNKNOWN_STONE_FALLBACK.highPerCt
  };
}

function toRateSummary(row: GemstoneRateRow): GemstoneRateSummary {
  return {
    stone: row.stone,
    displayName: row.displayName,
    commercial: toTierPrices(row.commercialLowPerCt, row.commercialHighPerCt),
    fine: toTierPrices(row.fineLowPerCt, row.fineHighPerCt),
    premium: toTierPrices(row.premiumLowPerCt, row.premiumHighPerCt),
    sources: row.sources,
    refreshedAt: row.refreshedAt.toISOString(),
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    isActive: row.isActive
  };
}

/**
 * Read a single gemstone rate from the DB. Case-insensitive on the stone name.
 * Returns null when no active row matches.
 */
export async function getGemstoneRate(stone: string): Promise<GemstoneRateSummary | null> {
  const normalized = stone.trim().toLowerCase();
  if (!normalized) return null;

  const row = await prisma.gemstoneRate.findFirst({
    where: {
      stone: { equals: normalized, mode: "insensitive" },
      isActive: true
    }
  });

  return row ? toRateSummary(row) : null;
}

/**
 * All active gemstone rates, ordered alphabetically. Used by the admin UI.
 */
export async function getGemstoneRates(): Promise<GemstoneRateSummary[]> {
  const rows = await prisma.gemstoneRate.findMany({
    where: { isActive: true },
    orderBy: { stone: "asc" }
  });

  return rows.map((row) => toRateSummary(row));
}

/**
 * Estimate the total cost of a set of accent colored gemstones.
 *
 * Uses the `commercial` tier by default — AutoQuote avoids overstating price when
 * treatment/origin/clarity are unknown. The result is an additive range line
 * item, never merged into the single ring price, so the main quote stays
 * precise (real metal + diamond rates) and the accent stones are flagged as
 * estimates that need jeweler confirmation.
 */
export function estimateAccentStoneCost(
  stones: AccentColorStoneSpec[],
  caratWeightEach: number = DEFAULT_ACCENT_CARAT
): AccentStoneCostEstimate {
  const safeCarat = Number.isFinite(caratWeightEach) && caratWeightEach > 0
    ? caratWeightEach
    : DEFAULT_ACCENT_CARAT;

  const lineItems: AccentStoneLineItem[] = stones
    .filter((s) => s && s.stone && s.count > 0)
    .map((s) => {
      const rate = getStaticFallbackRate(s.stone);
      const totalCarats = safeCarat * s.count;
      return {
        stone: s.stone,
        count: s.count,
        caratWeightEach: safeCarat,
        totalCarats,
        lowTotal: Math.round(totalCarats * rate.lowPerCt * 100) / 100,
        highTotal: Math.round(totalCarats * rate.highPerCt * 100) / 100
      };
    });

  const lowTotal = Math.round(lineItems.reduce((sum, item) => sum + item.lowTotal, 0) * 100) / 100;
  const highTotal = Math.round(lineItems.reduce((sum, item) => sum + item.highTotal, 0) * 100) / 100;

  const unknownStones = lineItems
    .filter((item) => getStaticFallbackRate(item.stone).note)
    .map((item) => item.stone);
  const unknownNote = unknownStones.length > 0
    ? ` Unknown stone(s) (${unknownStones.join(", ")}) use a conservative fallback range — confirm with your jeweler.`
    : "";

  return {
    tier: DEFAULT_TIER,
    caratWeightEach: safeCarat,
    lineItems,
    lowTotal,
    highTotal,
    disclaimer: `Accent stone estimate — final pricing requires sourcing confirmation.${unknownNote}`
  };
}

/**
 * Static fallback rates mirroring the seeded GemstoneRate rows. Used when a
 * stone is looked up synchronously (e.g. inside calculateMakingPrice) and the
 * DB is not reachable. Unknown stones get a conservative $50–$300/ct range
 * with a note so the quote never silently overstates the price.
 */
const STATIC_RATES: Record<string, GemstoneTierPrices> = {
  ruby: { lowPerCt: 300, highPerCt: 2000 },
  sapphire: { lowPerCt: 200, highPerCt: 1500 },
  emerald: { lowPerCt: 200, highPerCt: 2000 },
  tsavorite: { lowPerCt: 500, highPerCt: 3000 },
  alexandrite: { lowPerCt: 800, highPerCt: 5000 },
  tanzanite: { lowPerCt: 100, highPerCt: 800 },
  aquamarine: { lowPerCt: 50, highPerCt: 300 },
  amethyst: { lowPerCt: 10, highPerCt: 80 },
  peridot: { lowPerCt: 30, highPerCt: 200 },
  spinel: { lowPerCt: 50, highPerCt: 500 },
  tourmaline: { lowPerCt: 20, highPerCt: 150 },
  opal: { lowPerCt: 10, highPerCt: 100 }
};

export function getStaticFallbackRate(stone: string): GemstoneTierPrices & { note?: string } {
  const normalized = stone.trim().toLowerCase();
  if (!normalized) {
    return { ...UNKNOWN_STONE_FALLBACK, note: UNKNOWN_STONE_FALLBACK.note };
  }
  const rate = STATIC_RATES[normalized];
  if (rate) return { ...rate };
  return { ...UNKNOWN_STONE_FALLBACK, note: UNKNOWN_STONE_FALLBACK.note };
}